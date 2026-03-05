"use server";

import { DocumentStatus, DocumentType, ExportFormat, TemplateFormat } from "@prisma/client";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

import { requireAuthContext } from "@/features/auth/lib/session";
import { prisma } from "@/lib/db";

const MAX_TEMPLATE_FILE_SIZE = 8 * 1024 * 1024;
const STORAGE_ROOT = path.resolve(process.cwd(), "..", "storage");
const IMPORTS_ROOT = path.resolve(STORAGE_ROOT, "document-imports");
const TEMPLATE_COLUMNS_KEY_PREFIX = "template-columns:";
const DEFAULT_TEMPLATE_COLUMN_IDS = ["designation", "unite", "qte", "pu", "pt"] as const;
const DOCUMENT_ENGINE_URL = (process.env.DOCUMENT_ENGINE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
const DOCUMENT_ENGINE_TOKEN = (process.env.DOCUMENT_ENGINE_TOKEN || "").trim();
const ALLOWED_EXTENSIONS: Record<string, TemplateFormat> = {
  ".docx": TemplateFormat.DOCX,
  ".xlsx": TemplateFormat.XLSX,
  ".html": TemplateFormat.HTML,
  ".htm": TemplateFormat.HTML,
};

type TemplateVariableArray = string[];

export type TemplateAssetRow = {
  id: string;
  documentType: DocumentType;
  name: string;
  description: string;
  format: TemplateFormat;
  isDefault: boolean;
  isActive: boolean;
  versionNumber: number;
  fileName: string;
  fileSize: number;
  variables: TemplateVariableArray;
  uploadedAt: string;
  updatedAt: string;
};

type ListTemplateAssetsInput = {
  documentType?: DocumentType;
};

type SetDefaultTemplateInput = {
  templateId: string;
};

type DeleteTemplateInput = {
  templateId: string;
};

type QueueDocumentExportInput = {
  documentId: string;
  exportFormat: ExportFormat;
  templateId?: string | null;
};

function normalizeName(value: string, fallback: string) {
  const cleaned = value.trim();
  return cleaned.length ? cleaned : fallback;
}

function parseVariables(raw: string) {
  const values = raw
    .split(/[,\n]/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return Array.from(new Set(values));
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function resolveTemplateFormat(fileName: string, explicitValue: string | null) {
  if (explicitValue === "DOCX" || explicitValue === "XLSX" || explicitValue === "HTML") {
    return explicitValue as TemplateFormat;
  }
  const extension = path.extname(fileName).toLowerCase();
  return ALLOWED_EXTENSIONS[extension] ?? null;
}

function toRelativeStoragePath(companyId: string, fileName: string) {
  return path.join("document-templates", companyId, fileName);
}

function toAbsoluteStoragePath(relativePath: string) {
  return path.resolve(STORAGE_ROOT, relativePath);
}

function parseJsonRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  return input as Record<string, unknown>;
}

function readText(input: unknown) {
  return typeof input === "string" ? input : "";
}

function toNumeric(input: unknown) {
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readTemplateColumnIds(input: unknown) {
  const output: string[] = [];
  if (Array.isArray(input)) {
    for (const item of input) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        continue;
      }
      const source = item as Record<string, unknown>;
      const id = typeof source.id === "string" ? source.id.trim() : "";
      const enabled = source.enabled !== false;
      if (!id || !enabled) {
        continue;
      }
      output.push(id);
    }
  }

  for (const id of DEFAULT_TEMPLATE_COLUMN_IDS) {
    if (!output.includes(id)) {
      output.push(id);
    }
  }

  return output;
}

function normalizeImportCellText(value: unknown) {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value.replace(/\u00A0/g, " ").trim();
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  return String(value).trim();
}

function normalizeImportSearchText(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseImportNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const text = normalizeImportCellText(value);
  if (!text) {
    return null;
  }
  const normalized = text
    .replace(/\u00A0/g, "")
    .replace(/\s+/g, "")
    .replace(/,/g, ".")
    .replace(/[^0-9.-]/g, "");
  if (!normalized || normalized === "." || normalized === "-" || normalized === "-.") {
    return null;
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function includesImportKeyword(input: string, keywords: string[]) {
  const haystack = normalizeImportSearchText(input);
  return keywords.some((keyword) => haystack.includes(normalizeImportSearchText(keyword)));
}

function detectImportSheetColumns(rows: string[][]) {
  const designationKeywords = ["designation", "designation des ouvrages", "ouvrage", "ouvrages", "article", "description", "objet", "libelle", "item"];
  const unitKeywords = ["unite", "unit"];
  const qtyKeywords = ["qte", "quantite", "quantity", "qty"];
  const unitPriceKeywords = ["prix unitaire", "p.u", "pu", "unit price"];
  const totalKeywords = ["pt", "prix total", "total ht", "montant"];

  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 40); rowIndex += 1) {
    const row = rows[rowIndex];
    const designation = row.findIndex((cell) => includesImportKeyword(cell, designationKeywords));
    const qty = row.findIndex((cell) => includesImportKeyword(cell, qtyKeywords));
    const unit = row.findIndex((cell) => includesImportKeyword(cell, unitKeywords));
    const unitPrice = row.findIndex((cell) => includesImportKeyword(cell, unitPriceKeywords));
    const total = row.findIndex((cell) => includesImportKeyword(cell, totalKeywords));

    if (designation >= 0 && (qty >= 0 || unit >= 0 || unitPrice >= 0 || total >= 0)) {
      return {
        startRow: rowIndex + 1,
        designation,
        unit,
        qty,
        unitPrice,
        total,
      };
    }
  }

  return {
    startRow: 0,
    designation: 0,
    unit: -1,
    qty: -1,
    unitPrice: -1,
    total: -1,
  };
}

function readImportRowIndex(snapshotJson: unknown) {
  const snapshot = parseJsonRecord(snapshotJson);
  const rowRaw = readText(snapshot.import_row);
  const parsed = Number(rowRaw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.floor(parsed);
}

function toDateLabel(value: Date | null | undefined) {
  if (!value) {
    return "";
  }
  return value.toISOString().slice(0, 10);
}

const SMALL_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"] as const;
const TEEN_WORDS = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"] as const;
const TENS_WORDS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"] as const;

function wordsBelowThousand(value: number): string {
  if (value < 10) {
    return SMALL_WORDS[value] || "zero";
  }
  if (value < 20) {
    return TEEN_WORDS[value - 10] || "";
  }
  if (value < 100) {
    const tens = Math.floor(value / 10);
    const rest = value % 10;
    return rest ? `${TENS_WORDS[tens]} ${wordsBelowThousand(rest)}` : TENS_WORDS[tens] || "";
  }
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  if (!rest) {
    return `${wordsBelowThousand(hundreds)} hundred`;
  }
  return `${wordsBelowThousand(hundreds)} hundred ${wordsBelowThousand(rest)}`;
}

function integerToWords(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "zero";
  }
  const scales = [
    { size: 1_000_000_000, label: "billion" },
    { size: 1_000_000, label: "million" },
    { size: 1_000, label: "thousand" },
  ];
  let remaining = Math.floor(value);
  const parts: string[] = [];

  for (const scale of scales) {
    if (remaining < scale.size) {
      continue;
    }
    const chunk = Math.floor(remaining / scale.size);
    remaining %= scale.size;
    parts.push(`${wordsBelowThousand(chunk)} ${scale.label}`);
  }

  if (remaining > 0) {
    parts.push(wordsBelowThousand(remaining));
  }

  return parts.join(" ").trim() || "zero";
}

function amountToWords(value: number, currency: string) {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  const whole = Math.floor(safe);
  const cents = Math.round((safe - whole) * 100);
  const major = integerToWords(whole);
  if (cents <= 0) {
    return `${major} ${currency}`.trim();
  }
  return `${major} ${currency} and ${integerToWords(cents)} cents`;
}

function splitKeyPart(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

function flattenScalarValues(input: unknown, prefix = "", output: Record<string, string> = {}) {
  if (input === null || input === undefined) {
    return output;
  }
  if (Array.isArray(input)) {
    return output;
  }
  if (typeof input !== "object") {
    if (prefix) {
      output[prefix] = String(input);
    }
    return output;
  }

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    flattenScalarValues(value, nextPrefix, output);
  }
  return output;
}

function addAliasKeys(payload: Record<string, unknown>) {
  const flattened = flattenScalarValues(payload);
  const aliases: Record<string, unknown> = {};
  for (const [dottedKey, value] of Object.entries(flattened)) {
    const parts = dottedKey.split(".").flatMap(splitKeyPart);
    if (parts.length < 2) {
      continue;
    }
    const snake = parts.join("_");
    const camel = parts
      .map((part, index) => (index === 0 ? part : `${part.charAt(0).toUpperCase()}${part.slice(1)}`))
      .join("");
    if (!(snake in payload) && !(snake in aliases)) {
      aliases[snake] = value;
    }
    if (!(camel in payload) && !(camel in aliases)) {
      aliases[camel] = value;
    }
  }
  return {
    ...payload,
    ...aliases,
  };
}

function templateFormatByExportFormat(format: ExportFormat) {
  if (format === ExportFormat.PDF) {
    return TemplateFormat.DOCX;
  }
  if (format === ExportFormat.DOCX) {
    return TemplateFormat.DOCX;
  }
  if (format === ExportFormat.XLSX) {
    return TemplateFormat.XLSX;
  }
  return TemplateFormat.DOCX;
}

function extensionByExportFormat(format: ExportFormat) {
  if (format === ExportFormat.PDF) {
    return ".pdf";
  }
  if (format === ExportFormat.DOCX) {
    return ".docx";
  }
  if (format === ExportFormat.XLSX) {
    return ".xlsx";
  }
  return ".pdf";
}

function canUseDirectXlsxFallback(documentType: DocumentType, format: ExportFormat) {
  if (format !== ExportFormat.XLSX) {
    return false;
  }
  return (
    documentType === DocumentType.EXTRACT_BON_COMMANDE_PUBLIC ||
    documentType === DocumentType.EXTRACT_DEVIS
  );
}

function sanitizeSheetName(value: string) {
  const cleaned = value
    .replace(/[\\/?*\[\]:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return "Document";
  }
  return cleaned.slice(0, 31);
}

async function saveExportOutputFile(input: {
  companyId: string;
  preferredName: string;
  bytes: Buffer;
}) {
  const finalFileName = `${Date.now()}_${sanitizeFileName(input.preferredName)}`;
  const outputRelativePath = path.join("document-outputs", input.companyId, finalFileName);
  const outputAbsolutePath = toAbsoluteStoragePath(outputRelativePath);

  await mkdir(path.dirname(outputAbsolutePath), { recursive: true });
  await writeFile(outputAbsolutePath, input.bytes);

  return {
    finalFileName,
    outputRelativePath,
  };
}

function extractFilenameFromDisposition(headerValue: string | null) {
  if (!headerValue) {
    return null;
  }
  const simpleMatch = headerValue.match(/filename="([^"]+)"/i);
  if (simpleMatch?.[1]) {
    return sanitizeFileName(simpleMatch[1]);
  }
  const utfMatch = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (!utfMatch?.[1]) {
    return null;
  }
  try {
    return sanitizeFileName(decodeURIComponent(utfMatch[1]));
  } catch {
    return sanitizeFileName(utfMatch[1]);
  }
}

function summarizeLinesMissingUnitPrice(lines: Array<{ label: string; unitPriceHT: unknown }>) {
  const missing = lines.filter((line) => toNumeric(line.unitPriceHT) <= 0);
  if (!missing.length) {
    return null;
  }
  const names = missing
    .slice(0, 3)
    .map((line) => line.label.trim())
    .filter((label) => label.length > 0);
  const preview = names.length ? ` (${names.join(", ")}${missing.length > names.length ? ", ..." : ""})` : "";
  return `Unit price is required for all article lines before export. Missing ${missing.length} line(s)${preview}.`;
}

function toAssetRow(template: {
  id: string;
  documentType: DocumentType;
  name: string;
  description: string | null;
  templateFormat: TemplateFormat;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  version: {
    versionNumber: number;
    sourceJson: unknown;
    variablesJson: unknown;
  } | null;
}): TemplateAssetRow {
  const sourceJson = template.version && typeof template.version.sourceJson === "object" && template.version.sourceJson && !Array.isArray(template.version.sourceJson)
    ? (template.version.sourceJson as Record<string, unknown>)
    : {};
  const fileName = typeof sourceJson.fileName === "string" ? sourceJson.fileName : "";
  const fileSize = Number(sourceJson.fileSize);
  const rawVariables = Array.isArray(template.version?.variablesJson) ? template.version?.variablesJson : [];
  const variables = rawVariables.map((item) => String(item)).filter((item) => item.trim().length > 0);
  return {
    id: template.id,
    documentType: template.documentType,
    name: template.name,
    description: template.description || "",
    format: template.templateFormat,
    isDefault: template.isDefault,
    isActive: template.isActive,
    versionNumber: template.version?.versionNumber ?? 1,
    fileName,
    fileSize: Number.isFinite(fileSize) ? fileSize : 0,
    variables,
    uploadedAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

async function markDocumentAsExported(input: {
  companyId: string;
  actorId: string;
  documentId: string;
}) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.document.findFirst({
      where: {
        id: input.documentId,
        companyId: input.companyId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (
      !existing ||
      existing.status === DocumentStatus.ISSUED ||
      existing.status === DocumentStatus.PAID ||
      existing.status === DocumentStatus.CANCELLED
    ) {
      return;
    }

    await tx.document.update({
      where: { id: existing.id },
      data: {
        status: DocumentStatus.ISSUED,
      },
    });

    await tx.documentStatusEvent.create({
      data: {
        companyId: input.companyId,
        documentId: existing.id,
        actorId: input.actorId,
        fromStatus: existing.status,
        toStatus: DocumentStatus.ISSUED,
        note: "Status set automatically after export.",
      },
    });
  });
}

export async function listTemplateAssetsAction(input: ListTemplateAssetsInput = {}) {
  try {
    const auth = await requireAuthContext();
    const rows = await prisma.template.findMany({
      where: {
        companyId: auth.company.id,
        ...(input.documentType ? { documentType: input.documentType } : {}),
      },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        documentType: true,
        name: true,
        description: true,
        templateFormat: true,
        isDefault: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          select: {
            versionNumber: true,
            sourceJson: true,
            variablesJson: true,
          },
        },
      },
    });

    return {
      ok: true as const,
      rows: rows.map((row) =>
        toAssetRow({
          ...row,
          version: row.versions[0] ?? null,
        }),
      ),
    };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Failed to list templates.",
    };
  }
}

export async function uploadTemplateAssetAction(formData: FormData) {
  const auth = await requireAuthContext();

  const documentTypeValue = String(formData.get("documentType") ?? "").trim();
  const file = formData.get("file");
  const nameInput = String(formData.get("name") ?? "").trim();
  const descriptionInput = String(formData.get("description") ?? "").trim();
  const formatInput = String(formData.get("format") ?? "").trim() || null;
  const isDefault = String(formData.get("isDefault") ?? "").trim() === "1";
  const variables = parseVariables(String(formData.get("variables") ?? ""));

  if (!documentTypeValue) {
    return { ok: false as const, error: "Document type is required." };
  }
  if (!(file instanceof File)) {
    return { ok: false as const, error: "Template file is required." };
  }
  if (file.size > MAX_TEMPLATE_FILE_SIZE) {
    return { ok: false as const, error: "Template file is too large." };
  }

  const documentType = documentTypeValue as DocumentType;
  const format = resolveTemplateFormat(file.name, formatInput);
  if (!format) {
    return { ok: false as const, error: "Unsupported template format." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const originalName = sanitizeFileName(file.name || `template.${format.toLowerCase()}`);
  const storageName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${originalName}`;
  const relativePath = toRelativeStoragePath(auth.company.id, storageName);
  const absolutePath = toAbsoluteStoragePath(relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  const templateName = normalizeName(nameInput, path.basename(originalName, path.extname(originalName)));

  try {
    const created = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.template.updateMany({
          where: { companyId: auth.company.id, documentType },
          data: { isDefault: false },
        });
      }

      const template = await tx.template.create({
        data: {
          companyId: auth.company.id,
          documentType,
          name: templateName,
          description: descriptionInput || null,
          templateFormat: format,
          isDefault,
          isActive: true,
        },
        select: {
          id: true,
          documentType: true,
          name: true,
          description: true,
          templateFormat: true,
          isDefault: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const version = await tx.templateVersion.create({
        data: {
          companyId: auth.company.id,
          templateId: template.id,
          versionNumber: 1,
          engineName: "python-doc-engine",
          sourcePath: relativePath,
          sourceJson: {
            fileName: originalName,
            fileSize: file.size,
            mimeType: file.type || null,
          },
          variablesJson: variables,
          isPublished: true,
        },
        select: {
          versionNumber: true,
          sourceJson: true,
          variablesJson: true,
        },
      });

      return toAssetRow({
        ...template,
        version,
      });
    });

    return { ok: true as const, template: created };
  } catch (e) {
    try {
      await unlink(absolutePath);
    } catch {
      // Ignore cleanup errors.
    }
    const message = e instanceof Error ? e.message : "Failed to upload template.";
    return { ok: false as const, error: message };
  }
}

export async function setDefaultTemplateAssetAction(input: SetDefaultTemplateInput) {
  const auth = await requireAuthContext();
  const templateId = input.templateId.trim();
  if (!templateId) {
    return { ok: false as const, error: "Template id is required." };
  }

  const target = await prisma.template.findFirst({
    where: {
      id: templateId,
      companyId: auth.company.id,
    },
    select: {
      id: true,
      documentType: true,
    },
  });

  if (!target) {
    return { ok: false as const, error: "Template not found." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.template.updateMany({
      where: {
        companyId: auth.company.id,
        documentType: target.documentType,
      },
      data: { isDefault: false },
    });
    await tx.template.update({
      where: { id: target.id },
      data: { isDefault: true },
    });
  });

  return { ok: true as const };
}

export async function deleteTemplateAssetAction(input: DeleteTemplateInput) {
  const auth = await requireAuthContext();
  const templateId = input.templateId.trim();
  if (!templateId) {
    return { ok: false as const, error: "Template id is required." };
  }

  const target = await prisma.template.findFirst({
    where: {
      id: templateId,
      companyId: auth.company.id,
    },
    select: {
      id: true,
      isDefault: true,
      documentType: true,
      versions: {
        select: {
          sourcePath: true,
        },
      },
    },
  });

  if (!target) {
    return { ok: false as const, error: "Template not found." };
  }

  await prisma.template.delete({
    where: { id: target.id },
  });

  for (const version of target.versions) {
    if (!version.sourcePath) {
      continue;
    }
    try {
      await unlink(toAbsoluteStoragePath(version.sourcePath));
    } catch {
      // Ignore if file already removed.
    }
  }

  if (target.isDefault) {
    const fallback = await prisma.template.findFirst({
      where: {
        companyId: auth.company.id,
        documentType: target.documentType,
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    if (fallback) {
      await prisma.template.update({
        where: { id: fallback.id },
        data: { isDefault: true },
      });
    }
  }

  return { ok: true as const };
}

async function buildDocumentExportPayload(companyId: string, documentId: string) {
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      companyId,
    },
    select: {
      id: true,
      documentNumber: true,
      documentType: true,
      status: true,
      title: true,
      issueDate: true,
      dueDate: true,
      language: true,
      currency: true,
      subtotalHT: true,
      totalTax: true,
      totalTTC: true,
      amountPaid: true,
      amountDue: true,
      notes: true,
      terms: true,
      metadataJson: true,
      createdAt: true,
      updatedAt: true,
      client: {
        select: {
          code: true,
          name: true,
          email: true,
          phone: true,
          phoneFix: true,
          address: true,
          city: true,
          country: true,
          ice: true,
          ifNumber: true,
          notes: true,
        },
      },
      lineItems: {
        orderBy: { sortOrder: "asc" },
        select: {
          label: true,
          description: true,
          sku: true,
          unit: true,
          quantity: true,
          unitPriceHT: true,
          vatRate: true,
          lineSubtotalHT: true,
          lineTotalTTC: true,
          snapshotJson: true,
        },
      },
      company: {
        select: {
          name: true,
          profile: {
            select: {
              legalName: true,
              ice: true,
              ifNumber: true,
              phoneFix: true,
              email: true,
              addressLine1: true,
              city: true,
              country: true,
              bankName: true,
              iban: true,
              website: true,
            },
          },
        },
      },
    },
  });

  if (!document) {
    throw new Error("Document not found.");
  }

  const templateColumnsSetting = await prisma.companySetting.findUnique({
    where: {
      companyId_key: {
        companyId,
        key: `${TEMPLATE_COLUMNS_KEY_PREFIX}${document.documentType}`,
      },
    },
    select: {
      valueJson: true,
    },
  });
  const configuredLineColumnIds = readTemplateColumnIds(templateColumnsSetting?.valueJson);

  const metadata = parseJsonRecord(document.metadataJson);
  const clientSnapshot = parseJsonRecord(metadata.clientSnapshot);
  const profile = document.company.profile;
  const issueDateLabel = toDateLabel(document.issueDate || document.createdAt);
  const dueDateLabel = toDateLabel(document.dueDate);
  const currency = document.currency || "MAD";
  const totalTTC = toNumeric(document.totalTTC);
  const tvaRateRaw =
    metadata.tvaRate ??
    (document.lineItems.length ? toNumeric(document.lineItems[0].vatRate) : 20);
  const tvaRate = Number.isFinite(Number(tvaRateRaw)) ? Number(tvaRateRaw) : 20;

  const lines = document.lineItems.map((line, index) => {
    const snapshot = parseJsonRecord(line.snapshotJson);
    const merged: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(snapshot)) {
      if (value === null || value === undefined) {
        continue;
      }
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        merged[key] = value;
      }
    }
    for (const columnId of configuredLineColumnIds) {
      if (!(columnId in merged)) {
        merged[columnId] = "";
      }
    }

    const designation = readText(snapshot.designation) || line.label || "";
    const unit = readText(snapshot.unite) || line.unit || "u";
    const quantity = toNumeric(snapshot.qte || line.quantity);
    const unitPriceHT = toNumeric(snapshot.pu || line.unitPriceHT);
    const totalHT = toNumeric(snapshot.pt || line.lineSubtotalHT);
    const vatRate = toNumeric(snapshot.tvaRate || line.vatRate);
    const totalTTC = toNumeric(line.lineTotalTTC);

    return {
      index: index + 1,
      ...merged,
      designation,
      unit,
      quantity,
      unit_price_ht: unitPriceHT,
      total_ht: totalHT,
      total_ttc: totalTTC,
      vat_rate: vatRate,
      sku: readText(snapshot.sku) || line.sku || "",
      description: readText(snapshot.description) || line.description || "",
    };
  });

  const lineSample = lines[0] || (() => {
    const defaults: Record<string, unknown> = {
      designation: "",
      unit: "",
      quantity: 0,
      unit_price_ht: 0,
      total_ht: 0,
      total_ttc: 0,
      vat_rate: tvaRate,
    };
    for (const columnId of configuredLineColumnIds) {
      if (!(columnId in defaults)) {
        defaults[columnId] = "";
      }
    }
    return defaults;
  })();

  const payloadBase: Record<string, unknown> = {
    company: {
      legal_name: profile?.legalName || document.company.name || "",
      ice: profile?.ice || "",
      if_number: profile?.ifNumber || "",
      address: profile?.addressLine1 || "",
      city: profile?.city || "",
      country: profile?.country || "",
      phone_fix: profile?.phoneFix || "",
      email: profile?.email || "",
      bank: profile?.bankName || "",
      iban: profile?.iban || "",
      website: profile?.website || "",
    },
    document: {
      id: document.id,
      number: document.documentNumber,
      type: document.documentType,
      status: document.status,
      title: document.title || "",
      issue_date: issueDateLabel,
      due_date: dueDateLabel,
      language: document.language || "fr",
      currency,
      notes: document.notes || "",
      terms: document.terms || "",
      created_at: toDateLabel(document.createdAt),
      updated_at: toDateLabel(document.updatedAt),
    },
    client: {
      code: document.client?.code || readText(clientSnapshot.code) || "",
      name: document.client?.name || readText(clientSnapshot.name) || "",
      email: document.client?.email || readText(clientSnapshot.email) || "",
      phone: document.client?.phone || readText(clientSnapshot.phone) || "",
      phone_fix: document.client?.phoneFix || readText(clientSnapshot.phoneFix) || "",
      address: document.client?.address || readText(clientSnapshot.address) || "",
      city: document.client?.city || readText(clientSnapshot.city) || "",
      country: document.client?.country || readText(clientSnapshot.country) || "",
      ice: document.client?.ice || readText(clientSnapshot.ice) || "",
      if_number: document.client?.ifNumber || readText(clientSnapshot.ifNumber) || "",
      vat:
        document.client?.ifNumber ||
        readText(clientSnapshot.ifNumber) ||
        document.client?.ice ||
        readText(clientSnapshot.ice) ||
        "",
      notes: document.client?.notes || readText(clientSnapshot.notes) || "",
    },
    totals: {
      subtotal_ht: toNumeric(document.subtotalHT),
      total_tax: toNumeric(document.totalTax),
      total_ttc: totalTTC,
      total_ttc_in_words: amountToWords(totalTTC, currency),
      amount_paid: toNumeric(document.amountPaid),
      amount_due: toNumeric(document.amountDue),
      tva_rate: tvaRate,
    },
    line: lineSample,
    lines,
    items: lines,
    meta: metadata,
  };

  const projectNumber =
    readText(metadata.projectNumber) ||
    readText(metadata.project_number) ||
    readText(metadata.reference) ||
    "";
  const missionLabel =
    readText(metadata.missionLabel) ||
    readText(metadata.mission_label) ||
    readText(metadata.mission) ||
    "";
  const site =
    readText(metadata.site) ||
    readText(metadata.title) ||
    readText(metadata.projectSite) ||
    "";

  const payloadWithAliases: Record<string, unknown> = {
    ...payloadBase,
    documentNumber: (payloadBase.document as Record<string, unknown>).number || "",
    factureNumber: (payloadBase.document as Record<string, unknown>).number || "",
    invoiceNumber: (payloadBase.document as Record<string, unknown>).number || "",
    devisNumber: (payloadBase.document as Record<string, unknown>).number || "",
    factureDate: (payloadBase.document as Record<string, unknown>).issue_date || "",
    invoiceDate: (payloadBase.document as Record<string, unknown>).issue_date || "",
    dueDate: (payloadBase.document as Record<string, unknown>).due_date || "",
    clientName: (payloadBase.client as Record<string, unknown>).name || "",
    clientAddress: (payloadBase.client as Record<string, unknown>).address || "",
    clientVat: (payloadBase.client as Record<string, unknown>).vat || "",
    totalTTC: (payloadBase.totals as Record<string, unknown>).total_ttc || 0,
    totalTtcInWords: (payloadBase.totals as Record<string, unknown>).total_ttc_in_words || "",
    projectNumber,
    missionLabel,
    site,
  };

  return {
    documentNumber: document.documentNumber,
    payload: addAliasKeys(payloadWithAliases),
  };
}

async function buildDirectXlsxFromImportedSource(input: {
  companyId: string;
  documentId: string;
}) {
  const sourceDocument = await prisma.document.findFirst({
    where: {
      id: input.documentId,
      companyId: input.companyId,
    },
    select: {
      documentNumber: true,
      metadataJson: true,
      lineItems: {
        orderBy: { sortOrder: "asc" },
        select: {
          quantity: true,
          unitPriceHT: true,
          lineSubtotalHT: true,
          snapshotJson: true,
        },
      },
    },
  });

  if (!sourceDocument) {
    return null;
  }

  const metadata = parseJsonRecord(sourceDocument.metadataJson);
  const importSource = parseJsonRecord(metadata.importSource);
  const importJobId = readText(importSource.importJobId).trim();
  const sourceSheetName = readText(importSource.sheetName).trim();
  if (!importJobId) {
    return null;
  }

  const importJob = await prisma.importJob.findFirst({
    where: {
      id: importJobId,
      companyId: input.companyId,
    },
    select: {
      sourceFileName: true,
      sourceFilePath: true,
    },
  });

  if (!importJob?.sourceFilePath) {
    return null;
  }

  const absoluteSourcePath = toAbsoluteStoragePath(importJob.sourceFilePath);
  if (!absoluteSourcePath.startsWith(IMPORTS_ROOT)) {
    return null;
  }

  let bytes: Buffer;
  try {
    bytes = await readFile(absoluteSourcePath);
  } catch {
    return null;
  }

  const XLSX = await import("xlsx");
  const workbook = XLSX.read(bytes, { type: "buffer", cellDates: false });
  const sheetName =
    (sourceSheetName && workbook.Sheets[sourceSheetName] ? sourceSheetName : "") ||
    workbook.SheetNames[0] ||
    "Sheet1";
  if (!workbook.Sheets[sheetName]) {
    return null;
  }

  const worksheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: true }) as unknown[][];
  const textRows = rawRows.map((row) => row.map((cell) => normalizeImportCellText(cell)));
  const columns = detectImportSheetColumns(textRows);

  const lineItemsByRow = new Map<number, { quantity: number; unitPriceHT: number; lineSubtotalHT: number }>();
  for (const line of sourceDocument.lineItems) {
    const rowIndex1Based = readImportRowIndex(line.snapshotJson);
    if (!rowIndex1Based) {
      continue;
    }
    lineItemsByRow.set(rowIndex1Based - 1, {
      quantity: toNumeric(line.quantity),
      unitPriceHT: toNumeric(line.unitPriceHT),
      lineSubtotalHT: toNumeric(line.lineSubtotalHT),
    });
  }

  if (!lineItemsByRow.size) {
    return null;
  }

  const cellUpdates: Array<{ row: number; column: number; value: number }> = [];
  for (const [rowIndex, values] of lineItemsByRow.entries()) {
    if (columns.qty >= 0) {
      rawRows[rowIndex] = rawRows[rowIndex] || [];
      rawRows[rowIndex][columns.qty] = values.quantity;
      cellUpdates.push({
        row: rowIndex + 1,
        column: columns.qty + 1,
        value: values.quantity,
      });
    }
    if (columns.unitPrice >= 0) {
      rawRows[rowIndex] = rawRows[rowIndex] || [];
      rawRows[rowIndex][columns.unitPrice] = values.unitPriceHT;
      cellUpdates.push({
        row: rowIndex + 1,
        column: columns.unitPrice + 1,
        value: values.unitPriceHT,
      });
    }
    if (columns.total >= 0) {
      rawRows[rowIndex] = rawRows[rowIndex] || [];
      rawRows[rowIndex][columns.total] = values.lineSubtotalHT;
      cellUpdates.push({
        row: rowIndex + 1,
        column: columns.total + 1,
        value: values.lineSubtotalHT,
      });
    }
  }

  if (columns.designation >= 0 && columns.total >= 0) {
    let subtotalAccumulator = 0;
    let grandTotalAccumulator = 0;

    for (let rowIndex = columns.startRow; rowIndex < rawRows.length; rowIndex += 1) {
      const row = rawRows[rowIndex] || [];
      const designation = normalizeImportCellText(row[columns.designation]);
      if (!designation) {
        continue;
      }

      const normalizedDesignation = normalizeImportSearchText(designation);
      const quantity = columns.qty >= 0 ? parseImportNumber(row[columns.qty]) : null;
      const unitPrice = columns.unitPrice >= 0 ? parseImportNumber(row[columns.unitPrice]) : null;
      const lineTotal = parseImportNumber(row[columns.total]);

      const hasQty = quantity != null && quantity > 0;
      const hasUnitPrice = unitPrice != null && unitPrice > 0;
      const hasTotal = lineTotal != null && lineTotal > 0;
      const isSubtotalLabel = includesImportKeyword(normalizedDesignation, ["sous total", "subtotal", "total"]);
      const isSubtotalRow = isSubtotalLabel && !hasQty && !hasUnitPrice;
      const isCategoryRow = !isSubtotalRow && !hasQty && !hasUnitPrice && !hasTotal;

      if (isSubtotalRow) {
        const isGrandTotalRow = includesImportKeyword(normalizedDesignation, ["general", "global", "général", "totaux"]);
        const subtotalValue = isGrandTotalRow ? grandTotalAccumulator : subtotalAccumulator;
        rawRows[rowIndex][columns.total] = subtotalValue;
        cellUpdates.push({
          row: rowIndex + 1,
          column: columns.total + 1,
          value: subtotalValue,
        });
        if (!isGrandTotalRow) {
          subtotalAccumulator = 0;
        }
        continue;
      }

      if (isCategoryRow) {
        continue;
      }

      const effectiveLineTotal = parseImportNumber(rawRows[rowIndex]?.[columns.total]) || 0;
      subtotalAccumulator += effectiveLineTotal;
      grandTotalAccumulator += effectiveLineTotal;
    }
  }

  const sourceNameBase = path.parse(importJob.sourceFileName || sourceDocument.documentNumber).name;
  const preferredName = `${sanitizeFileName(sourceNameBase || sourceDocument.documentNumber)}.xlsx`;

  if (!cellUpdates.length) {
    return null;
  }

  const enginePayload = {
    __xlsx_import_patch__: {
      sheet_name: sheetName,
      cell_updates: cellUpdates,
    },
  };
  const body = new FormData();
  body.set("data", JSON.stringify(enginePayload));
  body.set("output_name", preferredName);
  body.set("output_format", "xlsx");
  body.set(
    "file",
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    importJob.sourceFileName || preferredName,
  );

  const headers: HeadersInit = {};
  if (DOCUMENT_ENGINE_TOKEN) {
    headers.Authorization = `Bearer ${DOCUMENT_ENGINE_TOKEN}`;
  }
  const response = await fetch(`${DOCUMENT_ENGINE_URL}/generate`, {
    method: "POST",
    body,
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    const raw = await response.text();
    let message = raw || `Document engine error (${response.status})`;
    try {
      const parsed = JSON.parse(raw) as { detail?: string };
      if (parsed.detail) {
        message = parsed.detail;
      }
    } catch {
      // Keep raw response message.
    }
    throw new Error(message);
  }
  const outputBytes = Buffer.from(await response.arrayBuffer());

  return {
    bytes: outputBytes,
    preferredName,
  };
}

async function buildDirectXlsxExportWithoutTemplate(input: {
  companyId: string;
  documentId: string;
}) {
  const fromSource = await buildDirectXlsxFromImportedSource(input);
  if (fromSource) {
    return fromSource;
  }

  const XLSX = await import("xlsx");
  const { payload, documentNumber } = await buildDocumentExportPayload(input.companyId, input.documentId);
  const payloadRecord = parseJsonRecord(payload);
  const linesRaw = Array.isArray(payloadRecord.lines) ? payloadRecord.lines : [];
  const totals = parseJsonRecord(payloadRecord.totals);

  const rows: Array<Array<string | number>> = [
    ["No", "Designation", "Unit", "Qty", "Unit price HT", "Total HT", "VAT %", "Total TTC", "Category"],
  ];

  for (let index = 0; index < linesRaw.length; index += 1) {
    const line = parseJsonRecord(linesRaw[index]);
    rows.push([
      index + 1,
      readText(line.designation),
      readText(line.unit),
      toNumeric(line.quantity),
      toNumeric(line.unit_price_ht),
      toNumeric(line.total_ht),
      toNumeric(line.vat_rate),
      toNumeric(line.total_ttc),
      readText(line.import_category),
    ]);
  }

  rows.push([]);
  rows.push(["", "", "", "", "Subtotal HT", toNumeric(totals.subtotal_ht), "", "", ""]);
  rows.push(["", "", "", "", "Total tax", toNumeric(totals.total_tax), "", "", ""]);
  rows.push(["", "", "", "", "Total TTC", toNumeric(totals.total_ttc), "", "", ""]);

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 6 }, { wch: 50 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 16 }, { wch: 24 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sanitizeSheetName(documentNumber));

  const rawBytes = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
  const bytes = Buffer.isBuffer(rawBytes) ? rawBytes : Buffer.from(rawBytes);
  const preferredName = `${sanitizeFileName(documentNumber)}.xlsx`;

  return {
    bytes,
    preferredName,
  };
}

export async function generateDocumentExportAction(input: QueueDocumentExportInput) {
  const auth = await requireAuthContext();
  const documentId = input.documentId.trim();
  if (!documentId) {
    return { ok: false as const, error: "Document id is required." };
  }

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      companyId: auth.company.id,
    },
    select: {
      id: true,
      documentType: true,
      documentNumber: true,
      lineItems: {
        select: {
          label: true,
          unitPriceHT: true,
        },
      },
    },
  });

  if (!document) {
    return { ok: false as const, error: "Document not found." };
  }

  const missingUnitPriceError = summarizeLinesMissingUnitPrice(document.lineItems);
  if (missingUnitPriceError) {
    return { ok: false as const, error: missingUnitPriceError };
  }

  const targetTemplateFormat = templateFormatByExportFormat(input.exportFormat);
  const allowDirectXlsxFallback = canUseDirectXlsxFallback(document.documentType, input.exportFormat);

  const template = input.templateId
    ? await prisma.template.findFirst({
        where: {
          id: input.templateId,
          companyId: auth.company.id,
          documentType: document.documentType,
          isActive: true,
        },
        select: {
          id: true,
          documentType: true,
          templateFormat: true,
          versions: {
            where: { isPublished: true },
            orderBy: { versionNumber: "desc" },
            take: 1,
            select: { id: true, sourcePath: true },
          },
        },
      })
    : await prisma.template.findFirst({
        where: {
          companyId: auth.company.id,
          documentType: document.documentType,
          isActive: true,
          templateFormat: targetTemplateFormat,
        },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        select: {
          id: true,
          documentType: true,
          templateFormat: true,
          versions: {
            where: { isPublished: true },
            orderBy: { versionNumber: "desc" },
            take: 1,
            select: { id: true, sourcePath: true },
          },
        },
      });

  if (!template && !allowDirectXlsxFallback) {
    return {
      ok: false as const,
      error: `No active ${targetTemplateFormat} template is available for this document type.`,
    };
  }

  if (!template && allowDirectXlsxFallback) {
    const startedAt = new Date();
    const job = await prisma.exportJob.create({
      data: {
        companyId: auth.company.id,
        documentId: document.id,
        templateId: null,
        templateVersionId: null,
        exportFormat: input.exportFormat,
        status: "RUNNING",
        startedAt,
      },
      select: {
        id: true,
      },
    });

    try {
      const { bytes, preferredName } = await buildDirectXlsxExportWithoutTemplate({
        companyId: auth.company.id,
        documentId: document.id,
      });
      const saved = await saveExportOutputFile({
        companyId: auth.company.id,
        preferredName,
        bytes,
      });

      await prisma.exportJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          outputPath: saved.outputRelativePath,
          errorMessage: null,
          completedAt: new Date(),
        },
      });

      await markDocumentAsExported({
        companyId: auth.company.id,
        actorId: auth.user.id,
        documentId: document.id,
      });

      return {
        ok: true as const,
        job: {
          id: job.id,
          format: input.exportFormat,
          status: "COMPLETED",
        },
        fileName: saved.finalFileName,
        downloadPath: `/api/exports/${job.id}/download`,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unable to generate export.";
      await prisma.exportJob
        .update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            errorMessage: message.slice(0, 1900),
            completedAt: new Date(),
          },
        })
        .catch(() => undefined);

      return { ok: false as const, error: message };
    }
  }

  const selectedVersion = template.versions[0];
  if (!selectedVersion?.sourcePath) {
    return { ok: false as const, error: "Selected template has no published source file." };
  }
  if (input.exportFormat === ExportFormat.PDF && template.templateFormat !== TemplateFormat.DOCX) {
    return {
      ok: false as const,
      error: "PDF export requires a DOCX template.",
    };
  }

  const startedAt = new Date();
  const job = await prisma.exportJob.create({
    data: {
      companyId: auth.company.id,
      documentId: document.id,
      templateId: template.id,
      templateVersionId: selectedVersion.id,
      exportFormat: input.exportFormat,
      status: "RUNNING",
      startedAt,
    },
    select: {
      id: true,
    },
  });

  try {
    const engineTemplatePath = toAbsoluteStoragePath(selectedVersion.sourcePath);
    const { payload, documentNumber } = await buildDocumentExportPayload(auth.company.id, document.id);
    const preferredName = `${sanitizeFileName(documentNumber)}${extensionByExportFormat(input.exportFormat)}`;

    const body = new FormData();
    body.set("data", JSON.stringify(payload));
    body.set("template_path", engineTemplatePath);
    body.set("output_name", preferredName);
    body.set("output_format", input.exportFormat.toLowerCase());

    const headers: HeadersInit = {};
    if (DOCUMENT_ENGINE_TOKEN) {
      headers.Authorization = `Bearer ${DOCUMENT_ENGINE_TOKEN}`;
    }

    const response = await fetch(`${DOCUMENT_ENGINE_URL}/generate`, {
      method: "POST",
      body,
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      const raw = await response.text();
      let message = raw || `Document engine error (${response.status})`;
      try {
        const parsed = JSON.parse(raw) as { detail?: string };
        if (parsed.detail) {
          message = parsed.detail;
        }
      } catch {
        // Ignore invalid JSON and keep raw message.
      }
      throw new Error(message);
    }

    const contentDisposition = response.headers.get("content-disposition");
    const engineFileName = extractFilenameFromDisposition(contentDisposition) || preferredName;
    const bytes = Buffer.from(await response.arrayBuffer());
    const saved = await saveExportOutputFile({
      companyId: auth.company.id,
      preferredName: engineFileName,
      bytes,
    });

    await prisma.exportJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        outputPath: saved.outputRelativePath,
        errorMessage: null,
        completedAt: new Date(),
      },
    });

    await markDocumentAsExported({
      companyId: auth.company.id,
      actorId: auth.user.id,
      documentId: document.id,
    });

    return {
      ok: true as const,
      job: {
        id: job.id,
        format: input.exportFormat,
        status: "COMPLETED",
      },
      fileName: saved.finalFileName,
      downloadPath: `/api/exports/${job.id}/download`,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unable to generate export.";
    await prisma.exportJob
      .update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          errorMessage: message.slice(0, 1900),
          completedAt: new Date(),
        },
      })
      .catch(() => undefined);

    return { ok: false as const, error: message };
  }
}

export async function queueDocumentExportAction(input: QueueDocumentExportInput) {
  const auth = await requireAuthContext();
  const documentId = input.documentId.trim();
  if (!documentId) {
    return { ok: false as const, error: "Document id is required." };
  }

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      companyId: auth.company.id,
    },
    select: {
      id: true,
      documentType: true,
    },
  });

  if (!document) {
    return { ok: false as const, error: "Document not found." };
  }

  let templateId: string | null = null;
  let templateVersionId: string | null = null;

  if (input.templateId) {
    const template = await prisma.template.findFirst({
      where: {
        id: input.templateId,
        companyId: auth.company.id,
        documentType: document.documentType,
      },
      select: {
        id: true,
        versions: {
          where: { isPublished: true },
          orderBy: { versionNumber: "desc" },
          take: 1,
          select: { id: true },
        },
      },
    });

    if (!template) {
      return { ok: false as const, error: "Selected template is not available for this document type." };
    }

    templateId = template.id;
    templateVersionId = template.versions[0]?.id || null;
  }

  const job = await prisma.exportJob.create({
    data: {
      companyId: auth.company.id,
      documentId: document.id,
      templateId,
      templateVersionId,
      exportFormat: input.exportFormat,
      status: "PENDING",
    },
    select: {
      id: true,
      exportFormat: true,
      status: true,
      createdAt: true,
    },
  });

  return {
    ok: true as const,
    job: {
      id: job.id,
      format: job.exportFormat,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
    },
  };
}
