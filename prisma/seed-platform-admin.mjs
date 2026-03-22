import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const SCRYPT_KEY_LENGTH = 64;

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString("hex");
  return `scrypt$${salt}$${derivedKey}`;
}

function toBool(value) {
  return String(value || "")
    .trim()
    .toLowerCase() === "true";
}

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.PLATFORM_OWNER_EMAIL || "owner@docv1.local").trim().toLowerCase();
  const fullName = (process.env.PLATFORM_OWNER_FULL_NAME || "Platform Super Admin").trim();
  const password = (process.env.PLATFORM_OWNER_PASSWORD || "ChangeMe123!").trim();
  const shouldResetPassword = toBool(process.env.PLATFORM_OWNER_RESET_PASSWORD);

  if (!email.includes("@")) {
    throw new Error("PLATFORM_OWNER_EMAIL must be a valid email.");
  }
  if (password.length < 8) {
    throw new Error("PLATFORM_OWNER_PASSWORD must be at least 8 characters.");
  }

  const existing = await prisma.platformUser.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!existing) {
    await prisma.platformUser.create({
      data: {
        email,
        fullName,
        role: "SUPER_ADMIN",
        isActive: true,
        passwordHash: hashPassword(password),
      },
    });
    console.log(`Created platform super admin: ${email}`);
    return;
  }

  await prisma.platformUser.update({
    where: { email },
    data: {
      fullName,
      role: "SUPER_ADMIN",
      isActive: true,
      ...(shouldResetPassword ? { passwordHash: hashPassword(password) } : {}),
    },
  });
  console.log(`Updated platform super admin: ${email}${shouldResetPassword ? " (password reset)" : ""}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
