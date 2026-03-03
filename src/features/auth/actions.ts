"use server";

import { MembershipRole } from "@prisma/client";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { isDatabaseConnectivityError } from "@/lib/errors/prisma";
import { ensureDemoAccount } from "@/features/auth/lib/demo";
import { hashPassword, verifyPassword } from "@/features/auth/lib/password";
import { clearAuthSession, setAuthSession } from "@/features/auth/lib/session";

function normalizeEmail(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeValue(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function toSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "workspace";
}

async function createCompanyWithUniqueSlug(companyName: string) {
  const baseSlug = toSlug(companyName);
  let attempt = 0;

  while (attempt < 30) {
    const suffix = attempt === 0 ? "" : `-${attempt + 1}`;
    const slug = `${baseSlug}${suffix}`;
    const exists = await prisma.company.findUnique({ where: { slug }, select: { id: true } });
    if (!exists) {
      return prisma.company.create({
        data: { name: companyName, slug },
      });
    }
    attempt += 1;
  }

  return prisma.company.create({
    data: {
      name: companyName,
      slug: `${baseSlug}-${Date.now()}`,
    },
  });
}

function loginErrorRedirect(errorCode: string, mode: "signin" | "signup"): never {
  const params = new URLSearchParams({
    mode,
    error: errorCode,
  });
  redirect(`/login?${params.toString()}`);
}

export async function signInAction(formData: FormData) {
  try {
    await ensureDemoAccount();

    const email = normalizeEmail(formData.get("email"));
    const password = normalizeValue(formData.get("password"));

    if (!email || !password) {
      loginErrorRedirect("auth.errors.emailPasswordRequired", "signin");
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        passwordHash: true,
        memberships: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { companyId: true },
        },
      },
    });

    if (!user || !verifyPassword(password, user.passwordHash) || user.memberships.length === 0) {
      loginErrorRedirect("auth.errors.invalidCredentials", "signin");
    }

    await setAuthSession(user.id);
    redirect("/dashboard");
  } catch (error) {
    if (isDatabaseConnectivityError(error)) {
      loginErrorRedirect("auth.errors.databaseUnavailable", "signin");
    }
    throw error;
  }
}

export async function signUpAction(formData: FormData) {
  try {
    const fullName = normalizeValue(formData.get("fullName"));
    const email = normalizeEmail(formData.get("email"));
    const password = normalizeValue(formData.get("password"));
    const companyName = normalizeValue(formData.get("companyName"));

    if (!fullName || !email || !password || !companyName) {
      loginErrorRedirect("auth.errors.allFieldsRequired", "signup");
    }

    if (password.length < 8) {
      loginErrorRedirect("auth.errors.passwordTooShort", "signup");
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      loginErrorRedirect("auth.errors.emailAlreadyUsed", "signup");
    }

    const company = await createCompanyWithUniqueSlug(companyName);
    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash: hashPassword(password),
      },
      select: { id: true },
    });

    await prisma.companyMembership.create({
      data: {
        companyId: company.id,
        userId: user.id,
        role: MembershipRole.OWNER,
        isActive: true,
      },
    });

    await setAuthSession(user.id);
    redirect("/dashboard");
  } catch (error) {
    if (isDatabaseConnectivityError(error)) {
      loginErrorRedirect("auth.errors.databaseUnavailable", "signup");
    }
    throw error;
  }
}

export async function signOutAction() {
  await clearAuthSession();
  redirect("/login");
}
