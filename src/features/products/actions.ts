"use server";

import { prisma } from "@/lib/db";
import { requireAuthContext } from "@/features/auth/lib/session";

type DeleteProductInput = {
  productId: string;
};

type UpdateProductInput = {
  productId: string;
  sku?: string;
  name: string;
  description?: string;
  unit: string;
  priceHT: number;
  vatRate: number;
  isActive: boolean;
};

function cleanText(value: string | undefined) {
  const next = (value || "").trim();
  return next.length ? next : null;
}

function clampVat(value: number) {
  if (!Number.isFinite(value)) {
    return 20;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return value;
}

export async function updateProductAction(input: UpdateProductInput) {
  const auth = await requireAuthContext();
  const productId = input.productId.trim();
  if (!productId) {
    return { ok: false as const, error: "Product id is required." };
  }

  const name = input.name.trim();
  if (!name) {
    return { ok: false as const, error: "Designation is required." };
  }

  const unit = input.unit.trim();
  if (!unit) {
    return { ok: false as const, error: "Unit is required." };
  }

  const priceHT = Number(input.priceHT);
  if (!Number.isFinite(priceHT) || priceHT < 0) {
    return { ok: false as const, error: "Invalid unit price." };
  }

  const vatRate = clampVat(Number(input.vatRate));
  const sku = cleanText(input.sku);

  const existing = await prisma.product.findFirst({
    where: {
      id: productId,
      companyId: auth.company.id,
    },
    select: { id: true },
  });

  if (!existing) {
    return { ok: false as const, error: "Product not found." };
  }

  if (sku) {
    const duplicate = await prisma.product.findFirst({
      where: {
        companyId: auth.company.id,
        sku,
        id: { not: existing.id },
      },
      select: { id: true },
    });
    if (duplicate) {
      return { ok: false as const, error: "SKU already exists." };
    }
  }

  try {
    const product = await prisma.product.update({
      where: { id: existing.id },
      data: {
        sku,
        name,
        description: cleanText(input.description),
        unit,
        priceHT,
        vatRate,
        isActive: input.isActive,
      },
      select: {
        id: true,
        sku: true,
        name: true,
        description: true,
        unit: true,
        priceHT: true,
        vatRate: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return {
      ok: true as const,
      product: {
        id: product.id,
        sku: product.sku,
        name: product.name,
        description: product.description,
        unit: product.unit,
        priceHT: Number(product.priceHT),
        vatRate: Number(product.vatRate),
        isActive: product.isActive,
        updatedAt: product.updatedAt.toISOString(),
      },
    };
  } catch {
    return {
      ok: false as const,
      error: "Unable to update this article.",
    };
  }
}

export async function deleteProductAction(input: DeleteProductInput) {
  const auth = await requireAuthContext();
  const productId = input.productId.trim();
  if (!productId) {
    return { ok: false as const, error: "Product id is required." };
  }

  const existing = await prisma.product.findFirst({
    where: {
      id: productId,
      companyId: auth.company.id,
    },
    select: { id: true },
  });

  if (!existing) {
    return { ok: true as const };
  }

  try {
    await prisma.product.delete({
      where: { id: existing.id },
    });
    return { ok: true as const };
  } catch {
    return {
      ok: false as const,
      error: "Unable to delete this article.",
    };
  }
}
