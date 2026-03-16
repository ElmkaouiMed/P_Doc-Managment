"use server";

import path from "path";

import { prisma } from "@/lib/db";
import { getCompanyWriteAccessError, requireAuthContext } from "@/features/auth/lib/session";

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

type CatalogImportCandidate = {
  rowNumber: number;
  sku: string | null;
  name: string;
  description: string | null;
  unit: string;
  priceHT: number;
  vatRate: number;
  isActive: boolean;
};

type CatalogImportError = {
  rowNumber: number;
  message: string;
};

const PRODUCT_CATALOG_MAX_FILE_SIZE = 8 * 1024 * 1024;
const PRODUCT_CATALOG_MAX_ROWS = 5000;
const PRODUCT_CATALOG_ALLOWED_EXTENSIONS = new Set([".csv", ".xls", ".xlsx"]);
const PRODUCT_CATALOG_REQUIRED_COLUMNS = ["name", "unit", "price_ht"] as const;
const PRODUCT_CATALOG_HEADER_ALIASES: Record<string, string> = {
  designation: "name",
  article: "name",
  produit: "name",
  libelle: "name",
  desc: "description",
  unite: "unit",
  pu: "price_ht",
  unit_price: "price_ht",
  unit_price_ht: "price_ht",
  prix_unitaire: "price_ht",
  prix_unitaire_ht: "price_ht",
  tva: "vat_rate",
  tva_rate: "vat_rate",
  active: "is_active",
  enabled: "is_active",
};

const TRUE_VALUES = new Set(["1", "true", "yes", "y", "oui", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "n", "non", "off"]);

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

function normalizeCatalogToken(value: unknown) {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function toCatalogText(value: unknown) {
  return String(value || "").replace(/\u00A0/g, " ").trim();
}

function parseCatalogNumber(value: unknown) {
  const text = toCatalogText(value);
  if (!text) {
    return null;
  }
  const normalized = text
    .replace(/\s+/g, "")
    .replace(/,/g, ".")
    .replace(/[^0-9.-]/g, "");
  if (!normalized || normalized === "." || normalized === "-" || normalized === "-.") {
    return null;
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCatalogBoolean(value: unknown, fallback = true) {
  const token = normalizeCatalogToken(value);
  if (!token) {
    return fallback;
  }
  if (TRUE_VALUES.has(token)) {
    return true;
  }
  if (FALSE_VALUES.has(token)) {
    return false;
  }
  return fallback;
}

function getCatalogCell(row: unknown[], headerIndexes: Map<string, number>, column: string) {
  const index = headerIndexes.get(column);
  if (index == null || index < 0 || index >= row.length) {
    return "";
  }
  return row[index];
}

function isCatalogRowEmpty(row: unknown[]) {
  return row.every((cell) => !toCatalogText(cell));
}

function dedupeCatalogRows(rows: CatalogImportCandidate[]) {
  const deduped = new Map<string, CatalogImportCandidate>();
  for (const row of rows) {
    const key = row.sku ? `sku:${row.sku.toLowerCase()}` : `name:${row.name.toLowerCase()}`;
    deduped.set(key, row);
  }
  return {
    rows: Array.from(deduped.values()),
    duplicateRows: Math.max(0, rows.length - deduped.size),
  };
}

async function parseProductCatalogFile(fileBuffer: Buffer) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(fileBuffer, {
    type: "buffer",
    raw: false,
    cellDates: false,
  });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      rows: [] as CatalogImportCandidate[],
      errors: [{ rowNumber: 1, message: "Sheet is missing." }] as CatalogImportError[],
      totalRows: 0,
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as unknown[][];
  if (!matrix.length) {
    return {
      rows: [] as CatalogImportCandidate[],
      errors: [{ rowNumber: 1, message: "Sheet is empty." }] as CatalogImportError[],
      totalRows: 0,
    };
  }

  const rawHeaders = (matrix[0] || []).map((value) => normalizeCatalogToken(value));
  const headerIndexes = new Map<string, number>();
  rawHeaders.forEach((rawHeader, index) => {
    if (!rawHeader) {
      return;
    }
    const mapped = PRODUCT_CATALOG_HEADER_ALIASES[rawHeader] || rawHeader;
    if (!headerIndexes.has(mapped)) {
      headerIndexes.set(mapped, index);
    }
  });

  const missingColumns = PRODUCT_CATALOG_REQUIRED_COLUMNS.filter((column) => !headerIndexes.has(column));
  if (missingColumns.length) {
    return {
      rows: [] as CatalogImportCandidate[],
      errors: [
        {
          rowNumber: 1,
          message: `Missing required column(s): ${missingColumns.join(", ")}.`,
        },
      ] as CatalogImportError[],
      totalRows: 0,
    };
  }

  const rows: CatalogImportCandidate[] = [];
  const errors: CatalogImportError[] = [];
  let totalRows = 0;

  for (let rowIndex = 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex] || [];
    if (isCatalogRowEmpty(row)) {
      continue;
    }
    totalRows += 1;
    if (totalRows > PRODUCT_CATALOG_MAX_ROWS) {
      errors.push({
        rowNumber: rowIndex + 1,
        message: `Maximum ${PRODUCT_CATALOG_MAX_ROWS} rows are allowed per import.`,
      });
      break;
    }

    const name = toCatalogText(getCatalogCell(row, headerIndexes, "name"));
    if (!name) {
      errors.push({ rowNumber: rowIndex + 1, message: "Name is required." });
      continue;
    }

    const unit = toCatalogText(getCatalogCell(row, headerIndexes, "unit")) || "u";
    const parsedPrice = parseCatalogNumber(getCatalogCell(row, headerIndexes, "price_ht"));
    if (parsedPrice == null || parsedPrice < 0) {
      errors.push({ rowNumber: rowIndex + 1, message: "Invalid price_ht value." });
      continue;
    }

    const parsedVat = parseCatalogNumber(getCatalogCell(row, headerIndexes, "vat_rate"));
    const vatRate = clampVat(parsedVat == null ? 20 : parsedVat);
    const sku = cleanText(toCatalogText(getCatalogCell(row, headerIndexes, "sku")));
    const description = cleanText(toCatalogText(getCatalogCell(row, headerIndexes, "description")));
    const isActive = parseCatalogBoolean(getCatalogCell(row, headerIndexes, "is_active"), true);

    rows.push({
      rowNumber: rowIndex + 1,
      sku,
      name,
      description,
      unit,
      priceHT: parsedPrice,
      vatRate,
      isActive,
    });
  }

  return {
    rows,
    errors,
    totalRows,
  };
}

export async function updateProductAction(input: UpdateProductInput) {
  const auth = await requireAuthContext();
  const writeAccessError = getCompanyWriteAccessError(auth);
  if (writeAccessError) {
    return { ok: false as const, error: writeAccessError };
  }
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
  const writeAccessError = getCompanyWriteAccessError(auth);
  if (writeAccessError) {
    return { ok: false as const, error: writeAccessError };
  }
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

export async function importProductCatalogAction(formData: FormData) {
  const auth = await requireAuthContext();
  const writeAccessError = getCompanyWriteAccessError(auth);
  if (writeAccessError) {
    return { ok: false as const, error: writeAccessError };
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false as const, error: "Catalog file is required." };
  }
  if (file.size <= 0) {
    return { ok: false as const, error: "Catalog file is empty." };
  }
  if (file.size > PRODUCT_CATALOG_MAX_FILE_SIZE) {
    return { ok: false as const, error: "Catalog file is too large." };
  }

  const extension = path.extname(file.name || "").toLowerCase();
  if (!PRODUCT_CATALOG_ALLOWED_EXTENSIONS.has(extension)) {
    return { ok: false as const, error: "Invalid file format. Use .csv, .xls or .xlsx." };
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const parsed = await parseProductCatalogFile(fileBuffer);
  const deduped = dedupeCatalogRows(parsed.rows);

  if (!deduped.rows.length) {
    const firstError = parsed.errors[0]?.message || "No valid rows found.";
    return {
      ok: false as const,
      error: firstError,
      summary: {
        totalRows: parsed.totalRows,
        validRows: parsed.rows.length,
        invalidRows: parsed.errors.length,
        duplicateRows: deduped.duplicateRows,
      },
      errors: parsed.errors.slice(0, 20),
    };
  }

  const skuValues = deduped.rows
    .map((row) => row.sku)
    .filter((value): value is string => Boolean(value));
  const nameValues = deduped.rows.map((row) => row.name);

  const [existingBySkuRows, existingByNameRows] = await Promise.all([
    skuValues.length
      ? prisma.product.findMany({
          where: {
            companyId: auth.company.id,
            sku: { in: skuValues },
          },
          select: { id: true, sku: true, name: true },
        })
      : Promise.resolve([]),
    nameValues.length
      ? prisma.product.findMany({
          where: {
            companyId: auth.company.id,
            name: { in: nameValues },
          },
          select: { id: true, sku: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const existingBySku = new Map(existingBySkuRows.map((row) => [String(row.sku || "").toLowerCase(), row]));
  const existingByName = new Map(existingByNameRows.map((row) => [row.name.toLowerCase(), row]));

  let createdCount = 0;
  let updatedCount = 0;
  let failedCount = 0;
  const errors: CatalogImportError[] = [...parsed.errors];
  const products: Array<{
    id: string;
    sku: string | null;
    name: string;
    description: string | null;
    unit: string;
    priceHT: number;
    vatRate: number;
    isActive: boolean;
    updatedAt: string;
  }> = [];

  for (const row of deduped.rows) {
    const skuKey = row.sku ? row.sku.toLowerCase() : "";
    const nameKey = row.name.toLowerCase();
    const existing = (skuKey ? existingBySku.get(skuKey) : undefined) || existingByName.get(nameKey) || null;

    try {
      const product = existing
        ? await prisma.product.update({
            where: { id: existing.id },
            data: {
              sku: row.sku,
              name: row.name,
              description: row.description,
              unit: row.unit,
              priceHT: row.priceHT,
              vatRate: row.vatRate,
              isActive: row.isActive,
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
          })
        : await prisma.product.create({
            data: {
              companyId: auth.company.id,
              sku: row.sku,
              name: row.name,
              description: row.description,
              unit: row.unit,
              priceHT: row.priceHT,
              vatRate: row.vatRate,
              isActive: row.isActive,
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

      if (existing) {
        updatedCount += 1;
      } else {
        createdCount += 1;
      }

      const mapped = {
        id: product.id,
        sku: product.sku,
        name: product.name,
        description: product.description,
        unit: product.unit,
        priceHT: Number(product.priceHT),
        vatRate: Number(product.vatRate),
        isActive: product.isActive,
        updatedAt: product.updatedAt.toISOString(),
      };
      products.push(mapped);
      existingByName.set(mapped.name.toLowerCase(), { id: mapped.id, sku: mapped.sku, name: mapped.name });
      if (mapped.sku) {
        existingBySku.set(mapped.sku.toLowerCase(), { id: mapped.id, sku: mapped.sku, name: mapped.name });
      }
    } catch (error) {
      failedCount += 1;
      const message = error instanceof Error ? error.message : "Unable to import this row.";
      errors.push({
        rowNumber: row.rowNumber,
        message: message.slice(0, 220),
      });
    }
  }

  if (createdCount + updatedCount === 0) {
    return {
      ok: false as const,
      error: errors[0]?.message || "No rows were imported.",
      summary: {
        totalRows: parsed.totalRows,
        validRows: parsed.rows.length,
        invalidRows: parsed.errors.length,
        duplicateRows: deduped.duplicateRows,
      },
      errors: errors.slice(0, 30),
    };
  }

  return {
    ok: true as const,
    summary: {
      totalRows: parsed.totalRows,
      validRows: parsed.rows.length,
      invalidRows: parsed.errors.length,
      duplicateRows: deduped.duplicateRows,
      createdCount,
      updatedCount,
      failedCount,
    },
    products,
    errors: errors.slice(0, 30),
  };
}
