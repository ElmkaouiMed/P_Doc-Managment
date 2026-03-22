import { createHmac, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { CompanyAccountStatus, MembershipRole } from "@/lib/db-client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { CompanyAccessAction, hasCompanyAccess, lifecycleAccessError } from "@/features/billing/lib/account-lifecycle";
import { syncCompanyLifecycleStatus } from "@/features/billing/lib/account-lifecycle-service";
import { prisma } from "@/lib/db";
import { toPublicDatabaseError } from "@/lib/errors/prisma";
import { isDesktopMode } from "@/lib/runtime";

const SESSION_COOKIE_NAME = "doc_v1_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

type SessionPayload = {
  userId: string;
  exp: number;
};

export type AuthContext = {
  user: {
    id: string;
    email: string;
    fullName: string;
  };
  company: {
    id: string;
    name: string;
    slug: string;
    accountStatus: CompanyAccountStatus;
    trialEndsAt: Date | null;
    graceEndsAt: Date | null;
    lockedAt: Date | null;
  };
  role: MembershipRole;
};

export type CompanyAuthorAction = "create" | "update" | "delete" | "import" | "send" | "export";

function getSessionSecret() {
  return process.env.AUTH_SECRET ?? "doc-v1-local-dev-secret-change-me";
}

function base64UrlEncode(value: string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const normalized = padded.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function signPayload(payload: string) {
  const signature = createHmac("sha256", getSessionSecret()).update(payload).digest("base64");
  return signature.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function createSessionToken(input: SessionPayload) {
  const payloadJson = JSON.stringify(input);
  const encodedPayload = base64UrlEncode(payloadJson);
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(token: string): SessionPayload | null {
  const [encodedPayload, encodedSignature] = token.split(".");
  if (!encodedPayload || !encodedSignature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload);
  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(encodedSignature);

  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    if (!parsed?.userId || typeof parsed.exp !== "number") {
      return null;
    }
    if (parsed.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function setAuthSession(userId: string) {
  const expiresAtSeconds = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const token = createSessionToken({ userId, exp: expiresAtSeconds });
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAtSeconds * 1000),
  });
}

export async function clearAuthSession() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    return null;
  }

  const user = await prisma.user
    .findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        memberships: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: {
            role: true,
            company: {
              select: {
                id: true,
                name: true,
                slug: true,
                accountStatus: true,
                trialEndsAt: true,
                graceEndsAt: true,
                lockedAt: true,
              },
            },
          },
        },
      },
    })
    .catch((error: unknown) => {
      throw toPublicDatabaseError(error, "Unable to load the authenticated session");
    });

  const membership = user?.memberships[0];
  if (!user || !membership?.company) {
    return null;
  }

  const lifecycle = isDesktopMode() ? null : await syncCompanyLifecycleStatus(membership.company.id);
  const companyAccountStatus = isDesktopMode()
    ? CompanyAccountStatus.ACTIVE_PAID
    : lifecycle?.status || membership.company.accountStatus;

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
    },
    company: {
      id: membership.company.id,
      name: membership.company.name,
      slug: membership.company.slug,
      accountStatus: companyAccountStatus,
      trialEndsAt: isDesktopMode() ? null : membership.company.trialEndsAt,
      graceEndsAt: isDesktopMode() ? null : membership.company.graceEndsAt,
      lockedAt: isDesktopMode() ? null : membership.company.lockedAt,
    },
    role: membership.role,
  };
});

function resolveAccessActionForAuthorAction(action: CompanyAuthorAction): CompanyAccessAction {
  void action;
  return "author";
}

export function getCompanyActionAccessError(auth: Pick<AuthContext, "company">, action: CompanyAuthorAction) {
  if (isDesktopMode()) {
    return null;
  }
  const accessAction = resolveAccessActionForAuthorAction(action);
  if (hasCompanyAccess(auth.company.accountStatus, accessAction)) {
    return null;
  }
  return lifecycleAccessError(auth.company.accountStatus, accessAction);
}

export function getCompanyWriteAccessError(auth: Pick<AuthContext, "company">) {
  return getCompanyActionAccessError(auth, "update");
}

export async function requireAuthContext() {
  const auth = await getAuthContext();
  if (!auth) {
    redirect("/login");
  }
  return auth;
}
