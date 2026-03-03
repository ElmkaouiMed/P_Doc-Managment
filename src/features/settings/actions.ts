"use server";

import { prisma } from "@/lib/db";
import { requireAuthContext } from "@/features/auth/lib/session";

const EMAIL_CONFIG_KEY = "email-config";

type EmailConfigMode = "gmail" | "host";

type EmailConfigInput = {
  mode: EmailConfigMode;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPassword: string;
  senderName: string;
  senderEmail: string;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeMode(value: unknown): EmailConfigMode {
  return value === "host" ? "host" : "gmail";
}

function sanitizeEmailConfig(raw: unknown): EmailConfigInput {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const mode = sanitizeMode(source.mode);
  const smtpUser = cleanText(source.smtpUser);
  const smtpHost = mode === "gmail" ? "smtp.gmail.com" : cleanText(source.smtpHost);
  const smtpPort = cleanText(source.smtpPort) || "587";
  const senderEmail = cleanText(source.senderEmail) || (mode === "gmail" ? smtpUser : "");

  return {
    mode,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPassword: cleanText(source.smtpPassword),
    senderName: cleanText(source.senderName),
    senderEmail,
  };
}

function defaultEmailConfig(): EmailConfigInput {
  return {
    mode: "gmail",
    smtpHost: "smtp.gmail.com",
    smtpPort: "587",
    smtpUser: "",
    smtpPassword: "",
    senderName: "",
    senderEmail: "",
  };
}

export async function getCompanyEmailConfigAction() {
  const auth = await requireAuthContext();
  const row = await prisma.companySetting.findUnique({
    where: {
      companyId_key: {
        companyId: auth.company.id,
        key: EMAIL_CONFIG_KEY,
      },
    },
    select: {
      valueJson: true,
    },
  });

  if (!row) {
    return { ok: true as const, config: defaultEmailConfig(), hasStored: false as const };
  }

  return { ok: true as const, config: sanitizeEmailConfig(row.valueJson), hasStored: true as const };
}

export async function saveCompanyEmailConfigAction(input: Partial<EmailConfigInput>) {
  const auth = await requireAuthContext();
  const next = sanitizeEmailConfig({
    ...defaultEmailConfig(),
    ...input,
  });

  await prisma.companySetting.upsert({
    where: {
      companyId_key: {
        companyId: auth.company.id,
        key: EMAIL_CONFIG_KEY,
      },
    },
    create: {
      companyId: auth.company.id,
      key: EMAIL_CONFIG_KEY,
      valueJson: next,
    },
    update: {
      valueJson: next,
    },
  });

  return { ok: true as const };
}
