"use server";

import { prisma } from "@/lib/db";
import { getDocumentEngineCapabilities } from "@/lib/document-engine";
import { getCompanyWriteAccessError, requireAuthContext } from "@/features/auth/lib/session";
import { APP_LOCALE_SETTING_KEY } from "@/i18n/constants";

const EMAIL_CONFIG_KEY = "email-config";
const GENERAL_INFO_LOCALE_KEY = APP_LOCALE_SETTING_KEY;
const BUSINESS_CONFIG_KEY = "business-config";
const EMAIL_TEMPLATES_KEY = "email-templates";
const EXPORT_SETTINGS_KEY = "exports";
const UNITS_KEY = "units";
const TEMPLATE_COLUMNS_KEY_PREFIX = "template-columns:";
const DOCUMENTS_VIEW_MODE_KEY = "documents-view-mode";
const CLIENTS_VIEW_MODE_KEY = "clients-view-mode";
const PRODUCTS_VIEW_MODE_KEY = "products-view-mode";
const MANUAL_DOCUMENT_TYPES = [
  "DEVIS",
  "FACTURE",
  "FACTURE_PROFORMA",
  "BON_LIVRAISON",
  "BON_COMMANDE",
] as const;
const ALL_DOCUMENT_TYPES = [
  "DEVIS",
  "FACTURE",
  "FACTURE_PROFORMA",
  "BON_LIVRAISON",
  "BON_COMMANDE",
  "EXTRACT_DEVIS",
  "EXTRACT_BON_COMMANDE_PUBLIC",
] as const;
const EXPORT_FORMATS = ["PDF", "DOCX", "XLSX"] as const;
const DEFAULT_UNITS = ["u", "kg", "m", "m2", "m3", "h", "jour", "forfait"] as const;
const DEFAULT_VIEW_MODE: ViewMode = "table";
const DEFAULT_LINE_COLUMNS = [
  { id: "designation", label: "Designation", dataType: "text", required: true, enabled: true, system: true },
  { id: "unite", label: "Unite", dataType: "unit", required: false, enabled: true, system: true },
  { id: "qte", label: "Qte", dataType: "number", required: true, enabled: true, system: true },
  { id: "pu", label: "P.U HT", dataType: "currency", required: true, enabled: true, system: true },
  { id: "pt", label: "P.T HT", dataType: "currency", required: false, enabled: true, system: true },
] as const;
const DEFAULT_EMAIL_TEMPLATES: EmailTemplateSettingsInput = {
  DEVIS: {
    enabled: true,
    autoSendOnCreate: true,
    subject: "Votre devis {{document_number}}",
    body: "Bonjour {{client_name}},\n\nVeuillez trouver ci-joint votre devis {{document_number}}.\nTotal: {{total_ttc}}\n\nCordialement,",
  },
  FACTURE: {
    enabled: true,
    autoSendOnCreate: false,
    subject: "Votre facture {{document_number}}",
    body: "Bonjour {{client_name}},\n\nVeuillez trouver ci-joint votre facture {{document_number}}.\nTotal: {{total_ttc}}\n\nCordialement,",
  },
  FACTURE_PROFORMA: {
    enabled: true,
    autoSendOnCreate: false,
    subject: "Votre facture proforma {{document_number}}",
    body: "Bonjour {{client_name}},\n\nVeuillez trouver ci-joint votre facture proforma {{document_number}}.\nTotal: {{total_ttc}}\n\nCordialement,",
  },
  BON_LIVRAISON: {
    enabled: true,
    autoSendOnCreate: false,
    subject: "Votre bon de livraison {{document_number}}",
    body: "Bonjour {{client_name}},\n\nVeuillez trouver ci-joint votre bon de livraison {{document_number}}.\n\nCordialement,",
  },
  BON_COMMANDE: {
    enabled: true,
    autoSendOnCreate: false,
    subject: "Votre bon de commande {{document_number}}",
    body: "Bonjour {{client_name}},\n\nVeuillez trouver ci-joint votre bon de commande {{document_number}}.\n\nCordialement,",
  },
  EXTRACT_DEVIS: {
    enabled: false,
    autoSendOnCreate: false,
    subject: "Extract devis {{document_number}}",
    body: "Bonjour {{client_name}},\n\nVeuillez trouver ci-joint le document {{document_number}}.\n\nCordialement,",
  },
  EXTRACT_BON_COMMANDE_PUBLIC: {
    enabled: false,
    autoSendOnCreate: false,
    subject: "Extract bon commande public {{document_number}}",
    body: "Bonjour {{client_name}},\n\nVeuillez trouver ci-joint le document {{document_number}}.\n\nCordialement,",
  },
};

type EmailConfigMode = "gmail" | "host";
type ManualDocumentType = (typeof MANUAL_DOCUMENT_TYPES)[number];
type DocumentTypeKey = (typeof ALL_DOCUMENT_TYPES)[number];
type ExportFormat = (typeof EXPORT_FORMATS)[number];
type ViewMode = "table" | "grid";
type ViewPreferenceScope = "documents" | "clients" | "products";
type ColumnDataType = "text" | "number" | "currency" | "unit" | "select" | "image";

type EmailConfigInput = {
  mode: EmailConfigMode;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPassword: string;
  senderName: string;
  senderEmail: string;
};

type AppLocale = "fr" | "en" | "ar";

type GeneralInfoInput = {
  legalName: string;
  ice: string;
  ifNumber: string;
  phoneFix: string;
  address: string;
  bank: string;
  language: AppLocale;
};

type BusinessConfigInput = {
  enabledDocumentTypes: ManualDocumentType[];
  defaultTvaRate: number;
  autoFillArticleUnitPrice: boolean;
};

type NumberingRuleInput = {
  documentType: ManualDocumentType;
  prefix: string;
  nextValue: number;
};

type EmailTemplateConfigInput = {
  enabled: boolean;
  autoSendOnCreate: boolean;
  subject: string;
  body: string;
};

type EmailTemplateSettingsInput = Record<DocumentTypeKey, EmailTemplateConfigInput>;

type ExportSettingsInput = {
  enabledFormats: ExportFormat[];
  defaultFormat: ExportFormat;
  outputFolder: string;
  includeAttachments: boolean;
};

type TemplateLineColumnInput = {
  id: string;
  label: string;
  dataType: ColumnDataType;
  selectOptions?: string[];
  required: boolean;
  enabled: boolean;
  system: boolean;
};

type EmailTemplateSettingsPatchInput = Partial<Record<DocumentTypeKey, Partial<EmailTemplateConfigInput>>>;

const DEFAULT_NUMBERING_PREFIX_BY_TYPE: Record<ManualDocumentType, string> = {
  DEVIS: "DEV",
  FACTURE: "FAC",
  FACTURE_PROFORMA: "PRO",
  BON_LIVRAISON: "BL",
  BON_COMMANDE: "BC",
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeMode(value: unknown): EmailConfigMode {
  return value === "host" ? "host" : "gmail";
}

function sanitizeLocale(value: unknown): AppLocale {
  return value === "en" || value === "ar" ? value : "fr";
}

function sanitizeDocumentTypes(input: unknown): ManualDocumentType[] {
  if (!Array.isArray(input)) {
    return [...MANUAL_DOCUMENT_TYPES];
  }
  const values = input.filter((item): item is ManualDocumentType =>
    MANUAL_DOCUMENT_TYPES.includes(item as ManualDocumentType),
  );
  if (!values.length) {
    return [...MANUAL_DOCUMENT_TYPES];
  }
  return [...new Set(values)];
}

function sanitizeTvaRate(input: unknown): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) {
    return 20;
  }
  if (parsed < 0) {
    return 0;
  }
  if (parsed > 100) {
    return 100;
  }
  return Number(parsed.toFixed(2));
}

function defaultNumberingPrefix(documentType: ManualDocumentType) {
  return DEFAULT_NUMBERING_PREFIX_BY_TYPE[documentType] || "DOC";
}

function sanitizeNumberingPrefix(input: unknown, fallbackPrefix: string): string {
  const normalized = cleanText(typeof input === "string" ? input.toUpperCase() : "")
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9_-]/g, "");
  return normalized || fallbackPrefix;
}

function sanitizeNextReferenceValue(input: unknown, fallback = 1): number {
  const parsed = Number.parseInt(String(input ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function normalizeNumberingRulesInput(input: unknown): NumberingRuleInput[] {
  const source = Array.isArray(input) ? input : [];
  const byType = new Map<ManualDocumentType, NumberingRuleInput>();

  for (const row of source) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      continue;
    }
    const candidate = row as Record<string, unknown>;
    const documentType = candidate.documentType;
    if (!MANUAL_DOCUMENT_TYPES.includes(documentType as ManualDocumentType)) {
      continue;
    }
    const typedDocumentType = documentType as ManualDocumentType;
    const fallbackPrefix = defaultNumberingPrefix(typedDocumentType);
    byType.set(typedDocumentType, {
      documentType: typedDocumentType,
      prefix: sanitizeNumberingPrefix(candidate.prefix, fallbackPrefix),
      nextValue: sanitizeNextReferenceValue(candidate.nextValue, 1),
    });
  }

  return MANUAL_DOCUMENT_TYPES.map((documentType) => {
    const existing = byType.get(documentType);
    if (existing) {
      return existing;
    }
    return {
      documentType,
      prefix: defaultNumberingPrefix(documentType),
      nextValue: 1,
    };
  });
}

function sanitizeBusinessConfig(raw: unknown): BusinessConfigInput {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    enabledDocumentTypes: sanitizeDocumentTypes(source.enabledDocumentTypes),
    defaultTvaRate: sanitizeTvaRate(source.defaultTvaRate),
    autoFillArticleUnitPrice:
      typeof source.autoFillArticleUnitPrice === "boolean" ? source.autoFillArticleUnitPrice : true,
  };
}

function sanitizeTemplateConfig(raw: unknown, fallback?: Partial<EmailTemplateConfigInput>): EmailTemplateConfigInput {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : fallback?.enabled ?? true,
    autoSendOnCreate:
      typeof source.autoSendOnCreate === "boolean" ? source.autoSendOnCreate : fallback?.autoSendOnCreate ?? false,
    subject: cleanText(source.subject ?? fallback?.subject ?? ""),
    body: cleanText(source.body ?? fallback?.body ?? ""),
  };
}

function sanitizeEmailTemplates(raw: unknown): EmailTemplateSettingsInput {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const output = {} as EmailTemplateSettingsInput;
  for (const documentType of ALL_DOCUMENT_TYPES) {
    output[documentType] = sanitizeTemplateConfig(source[documentType], DEFAULT_EMAIL_TEMPLATES[documentType]);
  }
  return output;
}

function sanitizeExportSettings(raw: unknown): ExportSettingsInput {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const formats = Array.isArray(source.enabledFormats)
    ? source.enabledFormats.filter((item): item is ExportFormat => EXPORT_FORMATS.includes(item as ExportFormat))
    : [];
  const enabledFormats = (formats.length ? Array.from(new Set(formats)) : [...EXPORT_FORMATS]) as ExportFormat[];
  const defaultFormatRaw = source.defaultFormat;
  const defaultFormat =
    typeof defaultFormatRaw === "string" && enabledFormats.includes(defaultFormatRaw as ExportFormat)
      ? (defaultFormatRaw as ExportFormat)
      : enabledFormats[0];
  const outputFolder = cleanText(source.outputFolder || "exports") || "exports";
  return {
    enabledFormats,
    defaultFormat,
    outputFolder,
    includeAttachments: typeof source.includeAttachments === "boolean" ? source.includeAttachments : false,
  };
}

async function applyEngineConstraintsToExportSettings(settings: ExportSettingsInput) {
  const capabilities = await getDocumentEngineCapabilities();
  if (capabilities.pdf.supported) {
    return {
      settings,
      capabilities,
    };
  }

  const enabledFormats = settings.enabledFormats.filter((format) => format !== "PDF");
  const fallbackFormats: ExportFormat[] = enabledFormats.length ? enabledFormats : ["DOCX", "XLSX"];
  return {
    settings: {
      ...settings,
      enabledFormats: fallbackFormats,
      defaultFormat: fallbackFormats.includes(settings.defaultFormat) ? settings.defaultFormat : fallbackFormats[0],
    },
    capabilities,
  };
}

function sanitizeUnits(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [...DEFAULT_UNITS];
  }
  const normalized = raw
    .map((item) => cleanText(item))
    .filter((item) => item.length > 0);
  const unique = Array.from(new Set(normalized));
  return unique.length ? unique : [...DEFAULT_UNITS];
}

function sanitizeSelectOptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const normalized = raw
    .map((item) => cleanText(item))
    .filter((item) => item.length > 0);
  return Array.from(new Set(normalized));
}

function normalizeColumn(column: TemplateLineColumnInput): TemplateLineColumnInput {
  const cleanId = cleanText(column.id)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_");
  const isDesignation = cleanId === "designation";
  const isUnit = cleanId === "unite";
  const dataType: ColumnDataType =
    column.dataType === "number" ||
    column.dataType === "currency" ||
    column.dataType === "unit" ||
    column.dataType === "select" ||
    column.dataType === "image"
      ? column.dataType
      : "text";
  const selectOptions = dataType === "select" ? sanitizeSelectOptions(column.selectOptions) : [];
  return {
    id: cleanId || "custom_col",
    label: cleanText(column.label) || "Custom",
    dataType: isUnit ? "unit" : dataType,
    selectOptions,
    enabled: isDesignation ? true : Boolean(column.enabled),
    required: isDesignation ? true : Boolean(column.required),
    system: isDesignation || isUnit ? true : Boolean(column.system),
  };
}

function sanitizeColumns(raw: unknown): TemplateLineColumnInput[] {
  if (!Array.isArray(raw)) {
    return DEFAULT_LINE_COLUMNS.map((column) => ({ ...column }));
  }
  const deduped: TemplateLineColumnInput[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const normalized = normalizeColumn(item as TemplateLineColumnInput);
    if (seen.has(normalized.id)) {
      continue;
    }
    seen.add(normalized.id);
    deduped.push(normalized);
  }
  for (const systemColumn of DEFAULT_LINE_COLUMNS) {
    if (!seen.has(systemColumn.id)) {
      deduped.push({ ...systemColumn });
    }
  }
  return deduped.map((column) => {
    if (column.id !== "designation") {
      return column;
    }
    return {
      ...column,
      enabled: true,
      required: true,
      system: true,
    };
  });
}

function templateColumnsKey(documentType: DocumentTypeKey) {
  return `${TEMPLATE_COLUMNS_KEY_PREFIX}${documentType}`;
}

function viewPreferenceKey(scope: ViewPreferenceScope) {
  if (scope === "clients") {
    return CLIENTS_VIEW_MODE_KEY;
  }
  if (scope === "products") {
    return PRODUCTS_VIEW_MODE_KEY;
  }
  return DOCUMENTS_VIEW_MODE_KEY;
}

function sanitizeViewMode(input: unknown): ViewMode {
  return input === "grid" ? "grid" : DEFAULT_VIEW_MODE;
}

function sanitizeDocumentType(input: unknown): DocumentTypeKey {
  return ALL_DOCUMENT_TYPES.includes(input as DocumentTypeKey) ? (input as DocumentTypeKey) : "DEVIS";
}

function sanitizeGeneralInfo(raw: unknown, companyName = ""): GeneralInfoInput {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    legalName: cleanText(source.legalName) || companyName,
    ice: cleanText(source.ice),
    ifNumber: cleanText(source.ifNumber),
    phoneFix: cleanText(source.phoneFix),
    address: cleanText(source.address),
    bank: cleanText(source.bank),
    language: sanitizeLocale(source.language),
  };
}

function readLocaleFromJson(valueJson: unknown): AppLocale | null {
  if (typeof valueJson === "string") {
    return sanitizeLocale(valueJson);
  }
  if (valueJson && typeof valueJson === "object" && !Array.isArray(valueJson)) {
    const language = (valueJson as Record<string, unknown>).language;
    if (language === "fr" || language === "en" || language === "ar") {
      return language;
    }
  }
  return null;
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

export async function getCompanyGeneralInfoAction() {
  const auth = await requireAuthContext();
  const [company, localeRow] = await Promise.all([
    prisma.company.findUnique({
      where: { id: auth.company.id },
      select: {
        name: true,
        profile: {
          select: {
            legalName: true,
            ice: true,
            ifNumber: true,
            phoneFix: true,
            addressLine1: true,
            bankName: true,
          },
        },
      },
    }),
    prisma.companySetting.findUnique({
      where: {
        companyId_key: {
          companyId: auth.company.id,
          key: GENERAL_INFO_LOCALE_KEY,
        },
      },
      select: {
        valueJson: true,
      },
    }),
  ]);

  if (!company) {
    return { ok: false as const, error: "Company not found." };
  }

  const settings: GeneralInfoInput = {
    legalName: company.profile?.legalName || company.name || "",
    ice: company.profile?.ice || "",
    ifNumber: company.profile?.ifNumber || "",
    phoneFix: company.profile?.phoneFix || "",
    address: company.profile?.addressLine1 || "",
    bank: company.profile?.bankName || "",
    language: readLocaleFromJson(localeRow?.valueJson) || "fr",
  };

  return {
    ok: true as const,
    hasStored: Boolean(company.profile || localeRow),
    settings,
  };
}

export async function getCompanyBusinessConfigAction() {
  const auth = await requireAuthContext();
  const row = await prisma.companySetting.findUnique({
    where: {
      companyId_key: {
        companyId: auth.company.id,
        key: BUSINESS_CONFIG_KEY,
      },
    },
    select: {
      valueJson: true,
    },
  });

  if (!row) {
    return {
      ok: true as const,
      hasStored: false as const,
      config: sanitizeBusinessConfig({}),
    };
  }

  return {
    ok: true as const,
    hasStored: true as const,
    config: sanitizeBusinessConfig(row.valueJson),
  };
}

export async function saveCompanyBusinessConfigAction(input: Partial<BusinessConfigInput>) {
  const auth = await requireAuthContext();
  const writeAccessError = getCompanyWriteAccessError(auth);
  if (writeAccessError) {
    return { ok: false as const, error: writeAccessError };
  }
  const existing = await prisma.companySetting.findUnique({
    where: {
      companyId_key: {
        companyId: auth.company.id,
        key: BUSINESS_CONFIG_KEY,
      },
    },
    select: {
      valueJson: true,
    },
  });
  const current = sanitizeBusinessConfig(existing?.valueJson ?? {});
  const next = sanitizeBusinessConfig({
    ...current,
    ...input,
  });

  await prisma.companySetting.upsert({
    where: {
      companyId_key: {
        companyId: auth.company.id,
        key: BUSINESS_CONFIG_KEY,
      },
    },
    create: {
      companyId: auth.company.id,
      key: BUSINESS_CONFIG_KEY,
      valueJson: next,
    },
    update: {
      valueJson: next,
    },
  });

  return { ok: true as const, config: next };
}

export async function getCompanyNumberingRulesAction() {
  const auth = await requireAuthContext();
  const rows = await prisma.numberingSequence.findMany({
    where: {
      companyId: auth.company.id,
    },
    select: {
      documentType: true,
      prefix: true,
      nextValue: true,
    },
  });

  const rules = normalizeNumberingRulesInput(
    rows
      .filter((row) => MANUAL_DOCUMENT_TYPES.includes(row.documentType as ManualDocumentType))
      .map((row) => ({
        documentType: row.documentType as ManualDocumentType,
        prefix: row.prefix,
        nextValue: row.nextValue,
      })),
  );

  return { ok: true as const, rules };
}

export async function saveCompanyNumberingRulesAction(input: {
  rules: Array<{
    documentType: ManualDocumentType;
    prefix: string;
    nextValue: number;
  }>;
}) {
  const auth = await requireAuthContext();
  const writeAccessError = getCompanyWriteAccessError(auth);
  if (writeAccessError) {
    return { ok: false as const, error: writeAccessError };
  }

  const rules = normalizeNumberingRulesInput(input.rules);
  const currentYear = new Date().getFullYear();

  await prisma.$transaction(
    rules.map((rule) =>
      prisma.numberingSequence.upsert({
        where: {
          companyId_documentType: {
            companyId: auth.company.id,
            documentType: rule.documentType,
          },
        },
        create: {
          companyId: auth.company.id,
          documentType: rule.documentType,
          prefix: rule.prefix,
          nextValue: rule.nextValue,
          currentYear,
        },
        update: {
          prefix: rule.prefix,
          nextValue: rule.nextValue,
          currentYear,
        },
      }),
    ),
  );

  return { ok: true as const, rules };
}

export async function saveCompanyGeneralInfoAction(input: Partial<GeneralInfoInput>) {
  const auth = await requireAuthContext();
  const writeAccessError = getCompanyWriteAccessError(auth);
  if (writeAccessError) {
    return { ok: false as const, error: writeAccessError };
  }
  const [company, localeRow] = await Promise.all([
    prisma.company.findUnique({
      where: { id: auth.company.id },
      select: {
        name: true,
        profile: {
          select: {
            legalName: true,
            ice: true,
            ifNumber: true,
            phoneFix: true,
            addressLine1: true,
            bankName: true,
          },
        },
      },
    }),
    prisma.companySetting.findUnique({
      where: {
        companyId_key: {
          companyId: auth.company.id,
          key: GENERAL_INFO_LOCALE_KEY,
        },
      },
      select: { valueJson: true },
    }),
  ]);

  if (!company) {
    return { ok: false as const, error: "Company not found." };
  }

  const current: GeneralInfoInput = {
    legalName: company.profile?.legalName || company.name || "",
    ice: company.profile?.ice || "",
    ifNumber: company.profile?.ifNumber || "",
    phoneFix: company.profile?.phoneFix || "",
    address: company.profile?.addressLine1 || "",
    bank: company.profile?.bankName || "",
    language: readLocaleFromJson(localeRow?.valueJson) || "fr",
  };

  const next = sanitizeGeneralInfo(
    {
      ...current,
      ...input,
    },
    company.name || "",
  );

  await prisma.$transaction([
    prisma.companyProfile.upsert({
      where: { companyId: auth.company.id },
      create: {
        companyId: auth.company.id,
        legalName: next.legalName || null,
        ice: next.ice || null,
        ifNumber: next.ifNumber || null,
        phoneFix: next.phoneFix || null,
        addressLine1: next.address || null,
        bankName: next.bank || null,
      },
      update: {
        legalName: next.legalName || null,
        ice: next.ice || null,
        ifNumber: next.ifNumber || null,
        phoneFix: next.phoneFix || null,
        addressLine1: next.address || null,
        bankName: next.bank || null,
      },
    }),
    prisma.companySetting.upsert({
      where: {
        companyId_key: {
          companyId: auth.company.id,
          key: GENERAL_INFO_LOCALE_KEY,
        },
      },
      create: {
        companyId: auth.company.id,
        key: GENERAL_INFO_LOCALE_KEY,
        valueJson: { language: next.language },
      },
      update: {
        valueJson: { language: next.language },
      },
    }),
  ]);

  return {
    ok: true as const,
    settings: next,
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
  const writeAccessError = getCompanyWriteAccessError(auth);
  if (writeAccessError) {
    return { ok: false as const, error: writeAccessError };
  }
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

export async function getCompanyEmailTemplatesAction() {
  const auth = await requireAuthContext();
  const row = await prisma.companySetting.findUnique({
    where: {
      companyId_key: {
        companyId: auth.company.id,
        key: EMAIL_TEMPLATES_KEY,
      },
    },
    select: {
      valueJson: true,
    },
  });

  if (!row) {
    return {
      ok: true as const,
      hasStored: false as const,
      templates: sanitizeEmailTemplates({}),
    };
  }

  return {
    ok: true as const,
    hasStored: true as const,
    templates: sanitizeEmailTemplates(row.valueJson),
  };
}

export async function saveCompanyEmailTemplatesAction(input: EmailTemplateSettingsPatchInput) {
  const auth = await requireAuthContext();
  const writeAccessError = getCompanyWriteAccessError(auth);
  if (writeAccessError) {
    return { ok: false as const, error: writeAccessError };
  }
  const existing = await prisma.companySetting.findUnique({
    where: {
      companyId_key: {
        companyId: auth.company.id,
        key: EMAIL_TEMPLATES_KEY,
      },
    },
    select: {
      valueJson: true,
    },
  });
  const current = sanitizeEmailTemplates(existing?.valueJson ?? {});
  const next = {} as EmailTemplateSettingsInput;
  for (const documentType of ALL_DOCUMENT_TYPES) {
    next[documentType] = sanitizeTemplateConfig(input?.[documentType] ?? {}, current[documentType]);
  }

  await prisma.companySetting.upsert({
    where: {
      companyId_key: {
        companyId: auth.company.id,
        key: EMAIL_TEMPLATES_KEY,
      },
    },
    create: {
      companyId: auth.company.id,
      key: EMAIL_TEMPLATES_KEY,
      valueJson: next,
    },
    update: {
      valueJson: next,
    },
  });

  return {
    ok: true as const,
    templates: next,
  };
}

export async function getCompanyExportSettingsAction() {
  const auth = await requireAuthContext();
  const row = await prisma.companySetting.findUnique({
    where: {
      companyId_key: {
        companyId: auth.company.id,
        key: EXPORT_SETTINGS_KEY,
      },
    },
    select: {
      valueJson: true,
    },
  });

  const normalized = sanitizeExportSettings(row?.valueJson ?? {});
  const constrained = await applyEngineConstraintsToExportSettings(normalized);

  if (!row) {
    return {
      ok: true as const,
      hasStored: false as const,
      settings: constrained.settings,
      capabilities: constrained.capabilities,
    };
  }

  return {
    ok: true as const,
    hasStored: true as const,
    settings: constrained.settings,
    capabilities: constrained.capabilities,
  };
}

export async function saveCompanyExportSettingsAction(input: Partial<ExportSettingsInput>) {
  const auth = await requireAuthContext();
  const writeAccessError = getCompanyWriteAccessError(auth);
  if (writeAccessError) {
    return { ok: false as const, error: writeAccessError };
  }
  const existing = await prisma.companySetting.findUnique({
    where: {
      companyId_key: {
        companyId: auth.company.id,
        key: EXPORT_SETTINGS_KEY,
      },
    },
    select: {
      valueJson: true,
    },
  });
  const current = sanitizeExportSettings(existing?.valueJson ?? {});
  const next = sanitizeExportSettings({
    ...current,
    ...input,
  });
  const constrained = await applyEngineConstraintsToExportSettings(next);

  await prisma.companySetting.upsert({
    where: {
      companyId_key: {
        companyId: auth.company.id,
        key: EXPORT_SETTINGS_KEY,
      },
    },
    create: {
      companyId: auth.company.id,
      key: EXPORT_SETTINGS_KEY,
      valueJson: next,
    },
    update: {
      valueJson: next,
    },
  });

  return {
    ok: true as const,
    settings: constrained.settings,
    capabilities: constrained.capabilities,
  };
}

export async function getCompanyDocumentUnitsAction() {
  const auth = await requireAuthContext();
  const row = await prisma.companySetting.findUnique({
    where: {
      companyId_key: {
        companyId: auth.company.id,
        key: UNITS_KEY,
      },
    },
    select: {
      valueJson: true,
    },
  });

  if (!row) {
    return {
      ok: true as const,
      hasStored: false as const,
      units: sanitizeUnits([]),
    };
  }

  return {
    ok: true as const,
    hasStored: true as const,
    units: sanitizeUnits(row.valueJson),
  };
}

export async function saveCompanyDocumentUnitsAction(units: string[]) {
  const auth = await requireAuthContext();
  const writeAccessError = getCompanyWriteAccessError(auth);
  if (writeAccessError) {
    return { ok: false as const, error: writeAccessError };
  }
  const next = sanitizeUnits(units);

  await prisma.companySetting.upsert({
    where: {
      companyId_key: {
        companyId: auth.company.id,
        key: UNITS_KEY,
      },
    },
    create: {
      companyId: auth.company.id,
      key: UNITS_KEY,
      valueJson: next,
    },
    update: {
      valueJson: next,
    },
  });

  return {
    ok: true as const,
    units: next,
  };
}

export async function getCompanyTemplateColumnsAction(documentType: DocumentTypeKey) {
  const auth = await requireAuthContext();
  const safeDocumentType = sanitizeDocumentType(documentType);
  const key = templateColumnsKey(safeDocumentType);
  const row = await prisma.companySetting.findUnique({
    where: {
      companyId_key: {
        companyId: auth.company.id,
        key,
      },
    },
    select: {
      valueJson: true,
    },
  });

  if (!row) {
    return {
      ok: true as const,
      hasStored: false as const,
      documentType: safeDocumentType,
      columns: sanitizeColumns([]),
    };
  }

  return {
    ok: true as const,
    hasStored: true as const,
    documentType: safeDocumentType,
    columns: sanitizeColumns(row.valueJson),
  };
}

export async function saveCompanyTemplateColumnsAction(input: {
  documentType: DocumentTypeKey;
  columns: TemplateLineColumnInput[];
}) {
  const auth = await requireAuthContext();
  const writeAccessError = getCompanyWriteAccessError(auth);
  if (writeAccessError) {
    return { ok: false as const, error: writeAccessError };
  }
  const safeDocumentType = sanitizeDocumentType(input.documentType);
  const key = templateColumnsKey(safeDocumentType);
  const next = sanitizeColumns(input.columns);

  await prisma.companySetting.upsert({
    where: {
      companyId_key: {
        companyId: auth.company.id,
        key,
      },
    },
    create: {
      companyId: auth.company.id,
      key,
      valueJson: next,
    },
    update: {
      valueJson: next,
    },
  });

  return {
    ok: true as const,
    documentType: safeDocumentType,
    columns: next,
  };
}

export async function getCompanyViewPreferenceAction(scope: ViewPreferenceScope) {
  const auth = await requireAuthContext();
  const key = viewPreferenceKey(scope);
  const row = await prisma.companySetting.findUnique({
    where: {
      companyId_key: {
        companyId: auth.company.id,
        key,
      },
    },
    select: {
      valueJson: true,
    },
  });

  if (!row) {
    return {
      ok: true as const,
      hasStored: false as const,
      mode: DEFAULT_VIEW_MODE,
    };
  }

  return {
    ok: true as const,
    hasStored: true as const,
    mode: sanitizeViewMode(row.valueJson),
  };
}

export async function saveCompanyViewPreferenceAction(input: { scope: ViewPreferenceScope; mode: ViewMode }) {
  const auth = await requireAuthContext();
  const writeAccessError = getCompanyWriteAccessError(auth);
  if (writeAccessError) {
    return { ok: false as const, error: writeAccessError };
  }
  const key = viewPreferenceKey(input.scope);
  const nextMode = sanitizeViewMode(input.mode);

  await prisma.companySetting.upsert({
    where: {
      companyId_key: {
        companyId: auth.company.id,
        key,
      },
    },
    create: {
      companyId: auth.company.id,
      key,
      valueJson: nextMode,
    },
    update: {
      valueJson: nextMode,
    },
  });

  return {
    ok: true as const,
    mode: nextMode,
  };
}
