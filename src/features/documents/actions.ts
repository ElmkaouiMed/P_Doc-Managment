"use server";

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { DocumentStatus, DocumentType, ImportType, Prisma, RelationType } from "@prisma/client";

import { requireAuthContext } from "@/features/auth/lib/session";
import {
  notifyDocumentStatusChange,
  notifyEmailFailure,
  notifyExportFailure,
  refreshDueDocumentNotifications,
} from "@/features/notifications/service";
import { generateDocumentExportAction } from "@/features/templates/actions";
import { prisma } from "@/lib/db";

type UpsertClientInput = {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  ice?: string;
  ifNumber?: string;
};

type UpsertProductInput = {
  designation: string;
  unite?: string;
  pu?: string;
  tvaRate?: number;
};

type DraftLineInput = Record<string, string>;

type CreateDocumentFromDraftInput = {
  documentType: DocumentType;
  issueDate?: string;
  dueDate?: string | null;
  client: {
    id?: string | null;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    ice?: string;
    ifNumber?: string;
  };
  totals: {
    subtotalHT: number;
    totalTax: number;
    totalTTC: number;
    tvaRate: number;
  };
  lines: DraftLineInput[];
};

type UpdateDocumentFromDraftInput = CreateDocumentFromDraftInput & {
  documentId: string;
};

type DeleteDocumentInput = {
  documentId?: string;
  documentNumber?: string;
  documentType?: DocumentType;
};

type UpdateDocumentStatusInput = {
  documentId: string;
  status: DocumentStatus;
  note?: string;
};

type GetDocumentForEditInput = {
  documentId: string;
};

type GetDocumentDetailsInput = {
  documentId: string;
};

type ConvertDocumentInput = {
  documentId: string;
  targetType: DocumentType;
};

type SendDocumentEmailInput = {
  documentId: string;
  recipient: string;
  subject: string;
  body: string;
};

const STORAGE_ROOT = path.resolve(process.cwd(), "..", "storage");
const EMAIL_CONFIG_KEY = "email-config";
const MAX_IMPORT_FILE_SIZE = 12 * 1024 * 1024;

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function toCleanText(value: string | undefined) {
  const clean = (value || "").trim();
  return clean.length ? clean : null;
}

function toNumber(value: string | undefined, fallback = 0) {
  const normalized = (value || "").replace(",", ".").trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampPercent(value: number, fallback = 20) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(100, value));
}

function formatMoney(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(2)} MAD`;
}

function formatDecimal(value: number, fractionDigits: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return value.toFixed(fractionDigits);
}

function parseDateInput(value: string | null | undefined) {
  const clean = (value || "").trim();
  if (!clean) {
    return null;
  }
  const parsed = new Date(`${clean}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function resolveDocumentDates(input: { documentType: DocumentType; issueDate?: string; dueDate?: string | null }) {
  const issueDate = parseDateInput(input.issueDate) || new Date();

  if (input.documentType !== DocumentType.FACTURE) {
    return { issueDate, dueDate: null as Date | null };
  }

  const explicitDueDate = parseDateInput(input.dueDate);
  return {
    issueDate,
    dueDate: explicitDueDate || addDays(issueDate, 30),
  };
}

function resolveDueDateForTargetType(input: {
  targetType: DocumentType;
  issueDate: Date;
  currentDueDate: Date | null;
}) {
  if (input.targetType !== DocumentType.FACTURE) {
    return null;
  }
  if (input.currentDueDate && input.currentDueDate >= input.issueDate) {
    return input.currentDueDate;
  }
  return addDays(input.issueDate, 30);
}

function countLinesMissingUnitPrice(lines: DraftLineInput[]) {
  return lines.reduce((count, line) => {
    const designation = (line.designation || "").trim();
    if (!designation) {
      return count;
    }
    const unitPrice = toNumber(line.pu, 0);
    return unitPrice > 0 ? count : count + 1;
  }, 0);
}

const OVERDUE_ELIGIBLE_STATUSES: DocumentStatus[] = [
  DocumentStatus.DRAFT,
  DocumentStatus.ISSUED,
  DocumentStatus.SENT,
  DocumentStatus.APPROVED,
  DocumentStatus.PARTIALLY_PAID,
];

async function syncOverdueStatuses(companyId: string) {
  await prisma.document.updateMany({
    where: {
      companyId,
      dueDate: { lt: new Date() },
      status: { in: OVERDUE_ELIGIBLE_STATUSES },
    },
    data: {
      status: DocumentStatus.OVERDUE,
    },
  });
}

function parseJsonObject(input: unknown) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null;
  }
  return input as Record<string, unknown>;
}

function readString(input: unknown) {
  return typeof input === "string" ? input : null;
}

type StoredEmailConfig = {
  mode: "gmail" | "host";
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  senderName: string;
  senderEmail: string;
};

function readEmailConfigFromSettings(valueJson: unknown): StoredEmailConfig | null {
  const source = parseJsonObject(valueJson);
  if (!source) {
    return null;
  }
  const mode = source.mode === "host" ? "host" : "gmail";
  const smtpUser = (readString(source.smtpUser) || "").trim();
  const smtpPassword = (readString(source.smtpPassword) || "").trim();
  const smtpHost = mode === "gmail" ? "smtp.gmail.com" : (readString(source.smtpHost) || "").trim();
  const smtpPortRaw = (readString(source.smtpPort) || "587").trim();
  const smtpPort = Number.parseInt(smtpPortRaw, 10);
  const senderName = (readString(source.senderName) || "").trim();
  const senderEmail = ((readString(source.senderEmail) || "").trim() || (mode === "gmail" ? smtpUser : ""));

  if (!smtpHost || !smtpUser || !smtpPassword || !Number.isFinite(smtpPort) || smtpPort <= 0 || smtpPort > 65535) {
    return null;
  }

  return {
    mode,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPassword,
    senderName,
    senderEmail,
  };
}

async function getCompanyEmailConfig(companyId: string): Promise<StoredEmailConfig | null> {
  const row = await prisma.companySetting.findUnique({
    where: {
      companyId_key: {
        companyId,
        key: EMAIL_CONFIG_KEY,
      },
    },
    select: {
      valueJson: true,
    },
  });

  if (!row) {
    return null;
  }
  return readEmailConfigFromSettings(row.valueJson);
}

function readClientSnapshot(metadataJson: unknown) {
  const metadata = parseJsonObject(metadataJson);
  const clientSnapshot = parseJsonObject(metadata?.clientSnapshot);
  if (!clientSnapshot) {
    return null;
  }
  return {
    name: readString(clientSnapshot.name),
    email: readString(clientSnapshot.email),
    phone: readString(clientSnapshot.phone),
    address: readString(clientSnapshot.address),
    ice: readString(clientSnapshot.ice),
    ifNumber: readString(clientSnapshot.ifNumber),
  };
}

function readTvaRate(metadataJson: unknown, fallback = 20) {
  const metadata = parseJsonObject(metadataJson);
  const raw = Number(metadata?.tvaRate);
  return clampPercent(raw, fallback);
}

function documentPrefix(type: DocumentType) {
  const map: Record<DocumentType, string> = {
    DEVIS: "DEV",
    FACTURE: "FAC",
    FACTURE_PROFORMA: "PRO",
    BON_LIVRAISON: "BL",
    BON_COMMANDE: "BC",
    EXTRACT_DEVIS: "EDV",
    EXTRACT_BON_COMMANDE_PUBLIC: "EBCP",
  };
  return map[type];
}

async function nextDocumentNumber(companyId: string, documentType: DocumentType) {
  const year = new Date().getFullYear();
  const prefix = documentPrefix(documentType);
  const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));

  const count = await prisma.document.count({
    where: {
      companyId,
      documentType,
      createdAt: {
        gte: yearStart,
        lt: yearEnd,
      },
    },
  });

  let sequence = count + 1;
  while (sequence < count + 1000) {
    const candidate = `${prefix}-${year}-${String(sequence).padStart(5, "0")}`;
    const exists = await prisma.document.findFirst({
      where: {
        companyId,
        documentType,
        documentNumber: candidate,
      },
      select: { id: true },
    });
    if (!exists) {
      return candidate;
    }
    sequence += 1;
  }

  return `${prefix}-${year}-${Date.now()}`;
}

async function resolveClientId(companyId: string, client: CreateDocumentFromDraftInput["client"]) {
  const clientName = client.name.trim();
  if (!clientName) {
    return null;
  }
  const clientIdFromInput = client.id?.trim();
  if (clientIdFromInput) {
    const linkedClient = await prisma.client.findFirst({
      where: {
        id: clientIdFromInput,
        companyId,
      },
      select: { id: true },
    });
    return linkedClient?.id || null;
  }
  const existingByName = await prisma.client.findFirst({
    where: {
      companyId,
      name: clientName,
    },
    select: { id: true },
  });
  return existingByName?.id || null;
}

function buildClientSnapshot(client: CreateDocumentFromDraftInput["client"]) {
  return {
    name: client.name.trim(),
    email: toCleanText(client.email),
    phone: toCleanText(client.phone),
    address: toCleanText(client.address),
    ice: toCleanText(client.ice),
    ifNumber: toCleanText(client.ifNumber),
  };
}

async function upsertLineItems(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    documentId: string;
    tvaRate: number;
    lines: DraftLineInput[];
  },
) {
  let sortOrder = 0;
  for (const line of input.lines) {
    const label = (line.designation || "").trim();
    if (!label) {
      continue;
    }

    const quantity = Math.max(0, toNumber(line.qte, 0));
    const unitPriceHT = Math.max(0, toNumber(line.pu, 0));
    const lineSubtotalHTRaw = toNumber(line.pt, quantity * unitPriceHT);
    const lineSubtotalHT = Math.max(0, lineSubtotalHTRaw);
    const lineVatRate = input.tvaRate;
    const lineTotalTTC = lineSubtotalHT * (1 + lineVatRate / 100);
    const unit = (line.unite || "u").trim() || "u";

    const existingProduct = await tx.product.findFirst({
      where: {
        companyId: input.companyId,
        name: label,
      },
      select: { id: true },
    });

    await tx.documentLineItem.create({
      data: {
        companyId: input.companyId,
        documentId: input.documentId,
        productId: existingProduct?.id || null,
        sortOrder,
        label,
        unit,
        quantity,
        unitPriceHT,
        discountRate: 0,
        vatRate: lineVatRate,
        lineSubtotalHT,
        lineTotalTTC,
        snapshotJson: line,
      },
    });
    sortOrder += 1;
  }
}

function toListRow(input: {
  id: string;
  number: string;
  type: DocumentType;
  client: string;
  status: DocumentStatus;
  totalTTC: number;
  issueDate: Date;
}) {
  return {
    id: input.id,
    number: input.number,
    type: input.type,
    client: input.client,
    status: input.status,
    total: formatMoney(input.totalTTC),
    issueDate: input.issueDate.toISOString(),
  };
}

async function applyDocumentStatusTransition(input: {
  companyId: string;
  actorId: string | null;
  documentId: string;
  toStatus: DocumentStatus;
  note?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.document.findFirst({
      where: {
        id: input.documentId,
        companyId: input.companyId,
      },
      select: {
        id: true,
        status: true,
        documentNumber: true,
      },
    });

    if (!existing) {
      return null;
    }

    if (existing.status === input.toStatus) {
      return {
        id: existing.id,
        documentNumber: existing.documentNumber,
        fromStatus: existing.status,
        toStatus: existing.status,
        status: existing.status,
        changed: false,
      };
    }

    const updated = await tx.document.update({
      where: { id: existing.id },
      data: { status: input.toStatus },
      select: { id: true, status: true, documentNumber: true },
    });

    await tx.documentStatusEvent.create({
      data: {
        companyId: input.companyId,
        documentId: existing.id,
        actorId: input.actorId,
        fromStatus: existing.status,
        toStatus: input.toStatus,
        note: toCleanText(input.note),
      },
    });

    return {
      id: updated.id,
      documentNumber: updated.documentNumber,
      fromStatus: existing.status,
      toStatus: updated.status,
      status: updated.status,
      changed: true,
    };
  });
}

export async function listDocumentsAction() {
  const auth = await requireAuthContext();
  await syncOverdueStatuses(auth.company.id);
  await refreshDueDocumentNotifications(auth.company.id).catch(() => ({ created: 0 }));

  const documents = await prisma.document.findMany({
    where: { companyId: auth.company.id },
    orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      documentNumber: true,
      documentType: true,
      status: true,
      totalTTC: true,
      issueDate: true,
      createdAt: true,
      metadataJson: true,
      client: {
        select: {
          name: true,
        },
      },
    },
  });

  const rows = documents.map((doc) => {
    const snapshot = readClientSnapshot(doc.metadataJson);
    return toListRow({
      id: doc.id,
      number: doc.documentNumber,
      type: doc.documentType,
      client: doc.client?.name || snapshot?.name || "Client",
      status: doc.status,
      totalTTC: Number(doc.totalTTC),
      issueDate: doc.issueDate || doc.createdAt,
    });
  });

  return { ok: true as const, rows };
}

export async function upsertClientFromDocumentAction(input: UpsertClientInput) {
  const auth = await requireAuthContext();
  const name = input.name.trim();
  if (!name) {
    return { ok: false as const, error: "Client name is required." };
  }

  const existing = await prisma.client.findFirst({
    where: {
      companyId: auth.company.id,
      name,
    },
    select: { id: true },
  });

  const payload = {
    name,
    email: toCleanText(input.email),
    phone: toCleanText(input.phone),
    address: toCleanText(input.address),
    ice: toCleanText(input.ice),
    ifNumber: toCleanText(input.ifNumber),
  };

  const client = existing
    ? await prisma.client.update({
        where: { id: existing.id },
        data: payload,
        select: { id: true, name: true },
      })
    : await prisma.client.create({
        data: {
          companyId: auth.company.id,
          ...payload,
        },
        select: { id: true, name: true },
      });

  return { ok: true as const, client };
}

export async function upsertProductFromDocumentAction(input: UpsertProductInput) {
  const auth = await requireAuthContext();
  const designation = input.designation.trim();
  if (!designation) {
    return { ok: false as const, error: "Product designation is required." };
  }

  const priceHT = toNumber(input.pu, 0);
  const vatRate = Number.isFinite(input.tvaRate) ? Math.max(0, Math.min(100, input.tvaRate || 0)) : 20;
  const unit = (input.unite || "u").trim() || "u";

  const existing = await prisma.product.findFirst({
    where: {
      companyId: auth.company.id,
      name: designation,
    },
    select: { id: true },
  });

  const payload = {
    name: designation,
    unit,
    priceHT,
    vatRate,
    isActive: true,
  };

  const product = existing
    ? await prisma.product.update({
        where: { id: existing.id },
        data: payload,
        select: { id: true, name: true },
      })
    : await prisma.product.create({
        data: {
          companyId: auth.company.id,
          ...payload,
        },
        select: { id: true, name: true },
      });

  return { ok: true as const, product };
}

export async function createDocumentFromDraftAction(input: CreateDocumentFromDraftInput) {
  const auth = await requireAuthContext();
  const companyId = auth.company.id;
  const clientName = input.client.name.trim();
  if (!clientName) {
    return { ok: false as const, error: "Client name is required." };
  }
  const linesMissingUnitPrice = countLinesMissingUnitPrice(input.lines);
  if (linesMissingUnitPrice > 0) {
    return {
      ok: false as const,
      error: `Unit price is required for all article lines. ${linesMissingUnitPrice} line(s) still missing a price.`,
    };
  }

  const documentNumber = await nextDocumentNumber(companyId, input.documentType);
  const tvaRate = clampPercent(input.totals.tvaRate, 20);
  const clientId = await resolveClientId(companyId, input.client);
  const { issueDate, dueDate } = resolveDocumentDates({
    documentType: input.documentType,
    issueDate: input.issueDate,
    dueDate: input.dueDate,
  });

  const created = await prisma.$transaction(async (tx) => {
    const createdDocument = await tx.document.create({
      data: {
        companyId,
        createdById: auth.user.id,
        clientId,
        documentType: input.documentType,
        documentNumber,
        status: DocumentStatus.DRAFT,
        issueDate,
        dueDate,
        language: "fr",
        currency: "MAD",
        subtotalHT: input.totals.subtotalHT,
        totalTax: input.totals.totalTax,
        totalTTC: input.totals.totalTTC,
        amountPaid: 0,
        amountDue: input.totals.totalTTC,
        metadataJson: {
          tvaRate,
          clientSnapshot: buildClientSnapshot(input.client),
        },
      },
      select: {
        id: true,
        documentNumber: true,
        documentType: true,
        status: true,
        issueDate: true,
        createdAt: true,
        totalTTC: true,
      },
    });

    await upsertLineItems(tx, {
      companyId,
      documentId: createdDocument.id,
      tvaRate,
      lines: input.lines,
    });

    return createdDocument;
  });

  return {
    ok: true as const,
    document: toListRow({
      id: created.id,
      number: created.documentNumber,
      type: created.documentType,
      client: clientName,
      status: created.status,
      totalTTC: Number(created.totalTTC),
      issueDate: created.issueDate || created.createdAt,
    }),
  };
}

export async function getDocumentForEditAction(input: GetDocumentForEditInput) {
  const auth = await requireAuthContext();
  await syncOverdueStatuses(auth.company.id);
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
      clientId: true,
      documentNumber: true,
      documentType: true,
      status: true,
      issueDate: true,
      dueDate: true,
      createdAt: true,
      metadataJson: true,
      client: {
        select: {
          name: true,
          email: true,
          phone: true,
          address: true,
          ice: true,
          ifNumber: true,
        },
      },
      lineItems: {
        orderBy: { sortOrder: "asc" },
        select: {
          label: true,
          unit: true,
          quantity: true,
          unitPriceHT: true,
          lineSubtotalHT: true,
          snapshotJson: true,
        },
      },
    },
  });

  if (!document) {
    return { ok: false as const, error: "Document not found." };
  }

  const snapshot = readClientSnapshot(document.metadataJson);
  const firstLineVat = document.lineItems.length > 0 ? Number(document.lineItems[0].snapshotJson ? parseJsonObject(document.lineItems[0].snapshotJson)?.tvaRate : null) : NaN;
  const tvaRate = readTvaRate(document.metadataJson, Number.isFinite(firstLineVat) ? firstLineVat : 20);
  const lines = document.lineItems.map((line) => {
    const fromSnapshotRaw = parseJsonObject(line.snapshotJson);
    const fromSnapshot: Record<string, string> = {};
    if (fromSnapshotRaw) {
      for (const [key, value] of Object.entries(fromSnapshotRaw)) {
        fromSnapshot[key] = typeof value === "string" ? value : value == null ? "" : String(value);
      }
    }
    const qte = fromSnapshot.qte || formatDecimal(Number(line.quantity), 3);
    const pu = fromSnapshot.pu || formatDecimal(Number(line.unitPriceHT), 2);
    const pt = fromSnapshot.pt || formatDecimal(Number(line.lineSubtotalHT), 2);
    return {
      ...fromSnapshot,
      designation: fromSnapshot.designation || line.label,
      unite: fromSnapshot.unite || line.unit || "u",
      qte,
      pu,
      pt,
    };
  });

  return {
    ok: true as const,
    document: {
      id: document.id,
      number: document.documentNumber,
      type: document.documentType,
      status: document.status,
      issueDate: (document.issueDate || document.createdAt).toISOString(),
      dueDate: document.dueDate?.toISOString() || null,
      tvaRate,
      client: {
        id: document.clientId,
        name: document.client?.name || snapshot?.name || "",
        email: document.client?.email || snapshot?.email || "",
        phone: document.client?.phone || snapshot?.phone || "",
        address: document.client?.address || snapshot?.address || "",
        ice: document.client?.ice || snapshot?.ice || "",
        ifNumber: document.client?.ifNumber || snapshot?.ifNumber || "",
      },
      lines,
    },
  };
}

export async function getDocumentDetailsAction(input: GetDocumentDetailsInput) {
  const auth = await requireAuthContext();
  await syncOverdueStatuses(auth.company.id);
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
      convertedFromId: true,
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          ice: true,
          ifNumber: true,
        },
      },
      createdBy: {
        select: {
          fullName: true,
          email: true,
        },
      },
      lineItems: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          label: true,
          unit: true,
          quantity: true,
          unitPriceHT: true,
          vatRate: true,
          lineSubtotalHT: true,
          lineTotalTTC: true,
          snapshotJson: true,
        },
      },
      statusEvents: {
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          fromStatus: true,
          toStatus: true,
          note: true,
          createdAt: true,
        },
      },
      sourceRelations: {
        select: {
          id: true,
          relationType: true,
          targetDocument: {
            select: {
              id: true,
              documentNumber: true,
              documentType: true,
            },
          },
        },
      },
      targetRelations: {
        select: {
          id: true,
          relationType: true,
          sourceDocument: {
            select: {
              id: true,
              documentNumber: true,
              documentType: true,
            },
          },
        },
      },
      attachments: {
        select: { id: true },
      },
    },
  });

  if (!document) {
    return { ok: false as const, error: "Document not found." };
  }

  const snapshot = readClientSnapshot(document.metadataJson);
  const tvaRate = readTvaRate(document.metadataJson, 20);
  const convertedFrom =
    document.convertedFromId
      ? await prisma.document.findFirst({
          where: {
            id: document.convertedFromId,
            companyId: auth.company.id,
          },
          select: {
            id: true,
            documentNumber: true,
            documentType: true,
          },
        })
      : null;

  const lines = document.lineItems.map((line) => {
    const fromSnapshotRaw = parseJsonObject(line.snapshotJson);
    const snapshotValues: Record<string, string> = {};
    if (fromSnapshotRaw) {
      for (const [key, value] of Object.entries(fromSnapshotRaw)) {
        snapshotValues[key] = typeof value === "string" ? value : value == null ? "" : String(value);
      }
    }
    const quantity = Number(line.quantity);
    const unitPriceHT = Number(line.unitPriceHT);
    const lineSubtotalHT = Number(line.lineSubtotalHT);
    const lineTotalTTC = Number(line.lineTotalTTC);
    const vatRateValue = Number(line.vatRate);

    return {
      id: line.id,
      designation: snapshotValues.designation || line.label,
      unit: snapshotValues.unite || line.unit || "u",
      quantity,
      unitPriceHT,
      vatRate: Number.isFinite(vatRateValue) ? vatRateValue : tvaRate,
      lineSubtotalHT,
      lineTotalTTC,
    };
  });

  return {
    ok: true as const,
    document: {
      id: document.id,
      number: document.documentNumber,
      type: document.documentType,
      status: document.status,
      title: document.title || "",
      issueDate: (document.issueDate || document.createdAt).toISOString(),
      dueDate: document.dueDate?.toISOString() || null,
      language: document.language,
      currency: document.currency,
      tvaRate,
      client: {
        id: document.client?.id || null,
        name: document.client?.name || snapshot?.name || "",
        email: document.client?.email || snapshot?.email || "",
        phone: document.client?.phone || snapshot?.phone || "",
        address: document.client?.address || snapshot?.address || "",
        ice: document.client?.ice || snapshot?.ice || "",
        ifNumber: document.client?.ifNumber || snapshot?.ifNumber || "",
      },
      totals: {
        subtotalHT: Number(document.subtotalHT),
        totalTax: Number(document.totalTax),
        totalTTC: Number(document.totalTTC),
        amountPaid: Number(document.amountPaid),
        amountDue: Number(document.amountDue),
      },
      notes: document.notes || "",
      terms: document.terms || "",
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
      createdBy: {
        name: document.createdBy.fullName,
        email: document.createdBy.email,
      },
      lines,
      attachmentsCount: document.attachments.length,
      convertedFrom: convertedFrom
        ? {
            id: convertedFrom.id,
            number: convertedFrom.documentNumber,
            type: convertedFrom.documentType,
          }
        : null,
      relatedTargets: document.sourceRelations.map((relation) => ({
        id: relation.targetDocument.id,
        number: relation.targetDocument.documentNumber,
        type: relation.targetDocument.documentType,
        relationType: relation.relationType,
      })),
      relatedSources: document.targetRelations.map((relation) => ({
        id: relation.sourceDocument.id,
        number: relation.sourceDocument.documentNumber,
        type: relation.sourceDocument.documentType,
        relationType: relation.relationType,
      })),
      statusEvents: document.statusEvents.map((event) => ({
        id: event.id,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        note: event.note || "",
        createdAt: event.createdAt.toISOString(),
      })),
    },
  };
}

export async function updateDocumentFromDraftAction(input: UpdateDocumentFromDraftInput) {
  const auth = await requireAuthContext();
  const companyId = auth.company.id;
  const documentId = input.documentId.trim();
  const clientName = input.client.name.trim();

  if (!documentId) {
    return { ok: false as const, error: "Document id is required." };
  }
  if (!clientName) {
    return { ok: false as const, error: "Client name is required." };
  }
  const linesMissingUnitPrice = countLinesMissingUnitPrice(input.lines);
  if (linesMissingUnitPrice > 0) {
    return {
      ok: false as const,
      error: `Unit price is required for all article lines. ${linesMissingUnitPrice} line(s) still missing a price.`,
    };
  }

  const existingDocument = await prisma.document.findFirst({
    where: {
      id: documentId,
      companyId,
    },
    select: {
      id: true,
      amountPaid: true,
      status: true,
      issueDate: true,
      createdAt: true,
      metadataJson: true,
      documentNumber: true,
      documentType: true,
    },
  });

  if (!existingDocument) {
    return { ok: false as const, error: "Document not found." };
  }

  const tvaRate = clampPercent(input.totals.tvaRate, 20);
  const clientId = await resolveClientId(companyId, input.client);
  const previousMetadata = parseJsonObject(existingDocument.metadataJson) || {};
  const { issueDate, dueDate } = resolveDocumentDates({
    documentType: input.documentType,
    issueDate: input.issueDate,
    dueDate: input.dueDate,
  });

  const updated = await prisma.$transaction(async (tx) => {
    const updatedDocument = await tx.document.update({
      where: { id: existingDocument.id },
      data: {
        clientId,
        documentType: input.documentType,
        issueDate,
        dueDate,
        subtotalHT: input.totals.subtotalHT,
        totalTax: input.totals.totalTax,
        totalTTC: input.totals.totalTTC,
        amountDue: Math.max(0, input.totals.totalTTC - Number(existingDocument.amountPaid)),
        metadataJson: {
          ...previousMetadata,
          tvaRate,
          clientSnapshot: buildClientSnapshot(input.client),
        },
      },
      select: {
        id: true,
        documentNumber: true,
        documentType: true,
        status: true,
        issueDate: true,
        createdAt: true,
        totalTTC: true,
      },
    });

    await tx.documentLineItem.deleteMany({
      where: {
        companyId,
        documentId: existingDocument.id,
      },
    });

    await upsertLineItems(tx, {
      companyId,
      documentId: existingDocument.id,
      tvaRate,
      lines: input.lines,
    });

    return updatedDocument;
  });

  return {
    ok: true as const,
    document: toListRow({
      id: updated.id,
      number: updated.documentNumber,
      type: updated.documentType,
      client: clientName,
      status: updated.status,
      totalTTC: Number(updated.totalTTC),
      issueDate: updated.issueDate || updated.createdAt,
    }),
  };
}

export async function updateDocumentStatusAction(input: UpdateDocumentStatusInput) {
  const auth = await requireAuthContext();
  await syncOverdueStatuses(auth.company.id);
  const documentId = input.documentId.trim();
  if (!documentId) {
    return { ok: false as const, error: "Document id is required." };
  }
  if (!Object.values(DocumentStatus).includes(input.status)) {
    return { ok: false as const, error: "Invalid document status." };
  }

  const updated = await applyDocumentStatusTransition({
    companyId: auth.company.id,
    actorId: auth.user.id,
    documentId,
    toStatus: input.status,
    note: input.note,
  });

  if (!updated) {
    return { ok: false as const, error: "Document not found." };
  }

  if (updated.changed) {
    await notifyDocumentStatusChange({
      companyId: auth.company.id,
      documentId: updated.id,
      documentNumber: updated.documentNumber,
      fromStatus: updated.fromStatus,
      toStatus: updated.toStatus,
    });
  }

  return {
    ok: true as const,
    document: updated,
  };
}

export async function sendDocumentEmailAction(input: SendDocumentEmailInput) {
  const auth = await requireAuthContext();
  await syncOverdueStatuses(auth.company.id);

  const documentId = input.documentId.trim();
  const subject = input.subject.trim();
  const body = input.body.trim();

  if (!documentId) {
    return { ok: false as const, error: "Document id is required." };
  }
  if (!subject) {
    return { ok: false as const, error: "Email subject is required." };
  }
  if (!body) {
    return { ok: false as const, error: "Email body is required." };
  }

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      companyId: auth.company.id,
    },
    select: {
      id: true,
      documentNumber: true,
      metadataJson: true,
      client: {
        select: {
          email: true,
        },
      },
    },
  });

  if (!document) {
    return { ok: false as const, error: "Document not found." };
  }

  const snapshot = readClientSnapshot(document.metadataJson);
  const recipient = (input.recipient || document.client?.email || snapshot?.email || "").trim();
  if (!recipient || !recipient.includes("@")) {
    return { ok: false as const, error: "Client email is missing or invalid." };
  }

  const emailConfig = await getCompanyEmailConfig(auth.company.id);
  if (!emailConfig) {
    return { ok: false as const, error: "Email configuration is missing. Open Settings > Emails and save SMTP config." };
  }

  const senderEmail = (emailConfig.senderEmail || emailConfig.smtpUser || "").trim();
  if (!senderEmail) {
    return { ok: false as const, error: "Sender email is missing in SMTP configuration." };
  }

  const exportResult = await generateDocumentExportAction({
    documentId,
    exportFormat: "PDF",
    templateId: null,
  });
  if (!exportResult.ok) {
    await notifyExportFailure({
      companyId: auth.company.id,
      documentId: document.id,
      documentNumber: document.documentNumber,
      message: exportResult.error || "Unable to generate PDF attachment.",
    });
    return { ok: false as const, error: exportResult.error || "Unable to generate PDF attachment." };
  }

  const exportJobId = exportResult.job?.id;
  if (!exportJobId) {
    return { ok: false as const, error: "Export job id is missing." };
  }

  const exportJob = await prisma.exportJob.findFirst({
    where: {
      id: exportJobId,
      companyId: auth.company.id,
      documentId,
    },
    select: {
      outputPath: true,
    },
  });
  if (!exportJob?.outputPath) {
    return { ok: false as const, error: "Unable to resolve exported PDF file path." };
  }

  const attachmentAbsolutePath = path.resolve(STORAGE_ROOT, exportJob.outputPath);
  const attachment = await readFile(attachmentAbsolutePath);

  try {
    const { createTransport } = await import("nodemailer");
    const transport = createTransport({
      host: emailConfig.smtpHost,
      port: emailConfig.smtpPort,
      secure: emailConfig.smtpPort === 465,
      auth: {
        user: emailConfig.smtpUser,
        pass: emailConfig.smtpPassword,
      },
    });

    const from = emailConfig.senderName
      ? `${emailConfig.senderName.replace(/"/g, "'")} <${senderEmail}>`
      : senderEmail;

    await transport.sendMail({
      from,
      to: recipient,
      subject,
      text: body,
      attachments: [
        {
          filename: exportResult.fileName || `${document.documentNumber}.pdf`,
          content: attachment,
          contentType: "application/pdf",
        },
      ],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "SMTP send failed.";
    await notifyEmailFailure({
      companyId: auth.company.id,
      documentId: document.id,
      documentNumber: document.documentNumber,
      message,
    });
    return { ok: false as const, error: `Unable to send email. ${message}` };
  }

  const updated = await applyDocumentStatusTransition({
    companyId: auth.company.id,
    actorId: auth.user.id,
    documentId,
    toStatus: DocumentStatus.SENT,
    note: "Status set automatically after successful email send.",
  });

  if (updated?.changed) {
    await notifyDocumentStatusChange({
      companyId: auth.company.id,
      documentId: updated.id,
      documentNumber: updated.documentNumber,
      fromStatus: updated.fromStatus,
      toStatus: updated.toStatus,
    });
  }

  return {
    ok: true as const,
    document: {
      id: document.id,
      status: updated?.status || DocumentStatus.SENT,
    },
    recipient,
  };
}

export async function deleteDocumentAction(input: DeleteDocumentInput) {
  const auth = await requireAuthContext();
  const documentId = input.documentId?.trim();

  let existing: { id: string } | null = null;
  if (documentId) {
    existing = await prisma.document.findFirst({
      where: {
        id: documentId,
        companyId: auth.company.id,
      },
      select: { id: true },
    });
  } else {
    const documentNumber = input.documentNumber?.trim() || "";
    if (!documentNumber || !input.documentType) {
      return { ok: false as const, error: "Document id or number/type is required." };
    }
    existing = await prisma.document.findFirst({
      where: {
        companyId: auth.company.id,
        documentNumber,
        documentType: input.documentType,
      },
      select: { id: true },
    });
  }

  if (!existing) {
    return { ok: true as const };
  }

  try {
    await prisma.document.delete({
      where: { id: existing.id },
    });
    return { ok: true as const };
  } catch {
    return {
      ok: false as const,
      error: "Unable to delete this document. It may be linked to payments or protected records.",
    };
  }
}

export async function queueExcelImportAction(formData: FormData) {
  const auth = await requireAuthContext();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false as const, error: "Excel file is required." };
  }
  if (file.size <= 0) {
    return { ok: false as const, error: "Excel file is empty." };
  }
  if (file.size > MAX_IMPORT_FILE_SIZE) {
    return { ok: false as const, error: "Excel file is too large." };
  }

  const extension = path.extname(file.name || "").toLowerCase();
  if (extension !== ".xls" && extension !== ".xlsx") {
    return { ok: false as const, error: "Only .xls and .xlsx files are supported." };
  }

  const safeOriginalName = sanitizeFileName(file.name || `import${extension || ".xlsx"}`);
  const storageFileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeOriginalName}`;
  const relativePath = path.join("document-imports", auth.company.id, storageFileName);
  const absolutePath = path.resolve(STORAGE_ROOT, relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

  const job = await prisma.importJob.create({
    data: {
      companyId: auth.company.id,
      createdById: auth.user.id,
      importType: ImportType.BON_COMMANDE_PUBLIC,
      sourceFileName: safeOriginalName,
      sourceFilePath: relativePath,
      status: "PENDING",
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      sourceFileName: true,
    },
  });

  return {
    ok: true as const,
    job: {
      id: job.id,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      fileName: job.sourceFileName,
    },
  };
}

export async function convertDocumentAction(input: ConvertDocumentInput) {
  const auth = await requireAuthContext();
  const documentId = input.documentId.trim();
  if (!documentId) {
    return { ok: false as const, error: "Document id is required." };
  }
  if (!Object.values(DocumentType).includes(input.targetType)) {
    return { ok: false as const, error: "Invalid target document type." };
  }

  const source = await prisma.document.findFirst({
    where: {
      id: documentId,
      companyId: auth.company.id,
    },
    select: {
      id: true,
      clientId: true,
      documentType: true,
      documentNumber: true,
      title: true,
      issueDate: true,
      dueDate: true,
      language: true,
      currency: true,
      subtotalHT: true,
      totalTax: true,
      totalTTC: true,
      notes: true,
      terms: true,
      metadataJson: true,
      createdAt: true,
      client: {
        select: { name: true },
      },
      lineItems: {
        orderBy: { sortOrder: "asc" },
        select: {
          productId: true,
          sortOrder: true,
          label: true,
          description: true,
          sku: true,
          unit: true,
          quantity: true,
          unitPriceHT: true,
          discountRate: true,
          vatRate: true,
          lineSubtotalHT: true,
          lineTotalTTC: true,
          snapshotJson: true,
        },
      },
    },
  });

  if (!source) {
    return { ok: false as const, error: "Source document not found." };
  }
  if (source.documentType === input.targetType) {
    return { ok: false as const, error: "Source and target types are identical." };
  }

  const allowedTargets = Object.values(DocumentType).filter((value) => value !== source.documentType);
  if (!allowedTargets.includes(input.targetType)) {
    return {
      ok: false as const,
      error: `Conversion from ${source.documentType} to ${input.targetType} is not allowed.`,
    };
  }

  const missingUnitPriceCount = source.lineItems.reduce((count, line) => {
    const label = (line.label || "").trim();
    if (!label) {
      return count;
    }
    return Number(line.unitPriceHT) > 0 ? count : count + 1;
  }, 0);
  if (missingUnitPriceCount > 0) {
    return {
      ok: false as const,
      error: `Unit price is required for all article lines. ${missingUnitPriceCount} line(s) still missing a price.`,
    };
  }

  const nextNumber = await nextDocumentNumber(auth.company.id, input.targetType);
  const nextIssueDate = new Date();
  const nextDueDate = resolveDueDateForTargetType({
    targetType: input.targetType,
    issueDate: nextIssueDate,
    currentDueDate: source.dueDate,
  });
  const sourceMetadata = parseJsonObject(source.metadataJson) || {};

  const created = await prisma.$transaction(async (tx) => {
    const target = await tx.document.create({
      data: {
        companyId: auth.company.id,
        createdById: auth.user.id,
        clientId: source.clientId,
        documentType: input.targetType,
        documentNumber: nextNumber,
        status: DocumentStatus.DRAFT,
        title: source.title || null,
        issueDate: nextIssueDate,
        dueDate: nextDueDate,
        language: source.language,
        currency: source.currency,
        subtotalHT: source.subtotalHT,
        totalTax: source.totalTax,
        totalTTC: source.totalTTC,
        amountPaid: 0,
        amountDue: source.totalTTC,
        notes: source.notes,
        terms: source.terms,
        convertedFromId: source.id,
        metadataJson: {
          ...sourceMetadata,
          convertedFrom: {
            id: source.id,
            number: source.documentNumber,
            type: source.documentType,
            convertedAt: new Date().toISOString(),
          },
        },
      },
      select: {
        id: true,
        documentNumber: true,
        documentType: true,
        status: true,
        totalTTC: true,
        issueDate: true,
        createdAt: true,
      },
    });

    if (source.lineItems.length > 0) {
      await tx.documentLineItem.createMany({
        data: source.lineItems.map((line) => ({
          companyId: auth.company.id,
          documentId: target.id,
          productId: line.productId,
          sortOrder: line.sortOrder,
          label: line.label,
          description: line.description,
          sku: line.sku,
          unit: line.unit,
          quantity: line.quantity,
          unitPriceHT: line.unitPriceHT,
          discountRate: line.discountRate,
          vatRate: line.vatRate,
          lineSubtotalHT: line.lineSubtotalHT,
          lineTotalTTC: line.lineTotalTTC,
          snapshotJson: line.snapshotJson,
        })),
      });
    }

    await tx.documentRelation.create({
      data: {
        companyId: auth.company.id,
        sourceDocumentId: source.id,
        targetDocumentId: target.id,
        relationType: RelationType.CONVERTED,
      },
    });

    await tx.documentStatusEvent.create({
      data: {
        companyId: auth.company.id,
        documentId: target.id,
        actorId: auth.user.id,
        fromStatus: null,
        toStatus: DocumentStatus.DRAFT,
        note: `Converted from ${source.documentNumber}.`,
      },
    });

    return target;
  });

  return {
    ok: true as const,
    source: {
      id: source.id,
      number: source.documentNumber,
      type: source.documentType,
    },
    document: toListRow({
      id: created.id,
      number: created.documentNumber,
      type: created.documentType,
      client: source.client?.name || readClientSnapshot(source.metadataJson)?.name || "Client",
      status: created.status,
      totalTTC: Number(created.totalTTC),
      issueDate: created.issueDate || created.createdAt,
    }),
  };
}
