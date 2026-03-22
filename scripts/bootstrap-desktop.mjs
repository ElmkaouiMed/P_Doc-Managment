import { randomBytes, scryptSync } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { applyDesktopSchema } from "./apply-desktop-schema.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webAdminRoot = path.resolve(__dirname, "..");
const generatedClientPath = path.join(webAdminRoot, "src", "generated", "desktop-prisma", "index.js");

function getRequiredEnv(name, fallback = "") {
  const value = (process.env[name] || fallback).trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derivedKey}`;
}

function slugify(value) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "workspace";
}

async function loadPrismaClient() {
  if (!existsSync(generatedClientPath)) {
    throw new Error("Desktop Prisma client has not been generated. Run `npm --prefix web_admin run db:generate:desktop` first.");
  }
  const moduleUrl = pathToFileURL(generatedClientPath).href;
  const imported = await import(moduleUrl);
  return imported;
}

async function main() {
  const databaseUrl = getRequiredEnv("DATABASE_URL");
  const companyName = getRequiredEnv("DESKTOP_COMPANY_NAME", "Local Workspace");
  const adminEmail = getRequiredEnv("DESKTOP_ADMIN_EMAIL", "owner@doc-v1.local").toLowerCase();
  const adminPassword = getRequiredEnv("DESKTOP_ADMIN_PASSWORD", "Desktop1234!");
  const adminFullName = getRequiredEnv("DESKTOP_ADMIN_FULL_NAME", "Local Admin");

  void databaseUrl;
  applyDesktopSchema();

  const { PrismaClient } = await loadPrismaClient();
  const prisma = new PrismaClient({
    log: ["error"],
  });

  try {
    const usersCount = await prisma.user.count();
    if (usersCount > 0) {
      return;
    }

    const baseSlug = slugify(companyName);
    let company = null;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
      const existing = await prisma.company.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (existing) {
        continue;
      }
      company = await prisma.company.create({
        data: {
          name: companyName,
          slug,
          accountStatus: "ACTIVE_PAID",
          activatedAt: new Date(),
        },
      });
      break;
    }

    if (!company) {
      throw new Error("Unable to create the default local workspace.");
    }

    const user = await prisma.user.create({
      data: {
        email: adminEmail,
        fullName: adminFullName,
        passwordHash: hashPassword(adminPassword),
      },
    });

    await prisma.companyMembership.create({
      data: {
        companyId: company.id,
        userId: user.id,
        role: "OWNER",
        isActive: true,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
