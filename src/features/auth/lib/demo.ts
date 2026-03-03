import { MembershipRole } from "@prisma/client";

import { prisma } from "@/lib/db";
import { hashPassword } from "./password";

type DemoAccountInfo = {
  email: string;
  password: string;
  fullName: string;
  companyName: string;
};

const defaultDemo: DemoAccountInfo = {
  email: process.env.DEMO_EMAIL ?? "demo@docv1.local",
  password: process.env.DEMO_PASSWORD ?? "Demo1234!",
  fullName: process.env.DEMO_FULL_NAME ?? "Demo Owner",
  companyName: process.env.DEMO_COMPANY_NAME ?? "Demo Workspace",
};

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
    data: { name: companyName, slug: `${baseSlug}-${Date.now()}` },
  });
}

export async function ensureDemoAccount() {
  const usersCount = await prisma.user.count();
  if (usersCount > 0) {
    return defaultDemo;
  }

  const existingDemo = await prisma.user.findUnique({
    where: { email: defaultDemo.email.toLowerCase() },
    select: { id: true },
  });
  if (existingDemo) {
    return defaultDemo;
  }

  const company = await createCompanyWithUniqueSlug(defaultDemo.companyName);
  const user = await prisma.user.create({
    data: {
      email: defaultDemo.email.toLowerCase(),
      fullName: defaultDemo.fullName,
      passwordHash: hashPassword(defaultDemo.password),
    },
  });

  await prisma.companyMembership.create({
    data: {
      companyId: company.id,
      userId: user.id,
      role: MembershipRole.OWNER,
      isActive: true,
    },
  });

  return defaultDemo;
}
