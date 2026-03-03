"use client";

import { APP_LOCALE_COOKIE } from "@/i18n/constants";

export const DOCUMENT_TYPE_OPTIONS = [
  "DEVIS",
  "FACTURE",
  "FACTURE_PROFORMA",
  "BON_LIVRAISON",
  "BON_COMMANDE",
  "EXTRACT_DEVIS",
  "EXTRACT_BON_COMMANDE_PUBLIC",
] as const;
export const DOCUMENT_STATUS_OPTIONS = [
  "DRAFT",
  "ISSUED",
  "SENT",
  "PAID",
  "OVERDUE",
  "CANCELLED",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPE_OPTIONS)[number];
export type DocumentStatus = (typeof DOCUMENT_STATUS_OPTIONS)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  DEVIS: "Devis",
  FACTURE: "Facture",
  FACTURE_PROFORMA: "Facture ProForma",
  BON_LIVRAISON: "Bon de livraison",
  BON_COMMANDE: "Bon de commande",
  EXTRACT_DEVIS: "Extract devis",
  EXTRACT_BON_COMMANDE_PUBLIC: "Extract bon commande public",
};

export type ColumnDataType = "text" | "number" | "currency" | "unit";

export type TemplateLineColumn = {
  id: string;
  label: string;
  dataType: ColumnDataType;
  required: boolean;
  enabled: boolean;
  system: boolean;
};

export type DraftClientInput = {
  name: string;
  email: string;
  phone: string;
  address: string;
  ice?: string;
  ifNumber?: string;
};

export type StoredClient = DraftClientInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredArticle = {
  id: string;
  designation: string;
  values: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

export type StoredDocument = {
  id: string;
  number: string;
  type: DocumentType;
  client: string;
  status: DocumentStatus;
  total: string;
  issueDate: string;
};

export type DocumentViewMode = "table" | "grid";
export type GeneralInfoSettings = {
  legalName: string;
  ice: string;
  ifNumber: string;
  phoneFix: string;
  address: string;
  bank: string;
  language: "fr" | "en" | "ar";
};

export type EmailConfigMode = "gmail" | "host";

export type EmailConfigSettings = {
  mode: EmailConfigMode;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPassword: string;
  senderName: string;
  senderEmail: string;
};

export type EmailTemplateConfig = {
  enabled: boolean;
  autoSendOnCreate: boolean;
  subject: string;
  body: string;
};

export type EmailTemplateSettings = Record<DocumentType, EmailTemplateConfig>;

export type NotificationSettings = {
  dueSoonDays: string;
  overdueDays: string;
  reminderTime: string;
};

export type ExportFormatOption = "PDF" | "DOCX" | "XLSX";

export type ExportSettings = {
  enabledFormats: ExportFormatOption[];
  defaultFormat: ExportFormatOption;
  outputFolder: string;
  includeAttachments: boolean;
};

export type UnitSettings = string[];

export const STORE_EVENTS = {
  documentsUpdated: "doc-v1-documents-updated",
  clientsUpdated: "doc-v1-clients-updated",
  articlesUpdated: "doc-v1-articles-updated",
  templateColumnsUpdated: "doc-v1-template-columns-updated",
  businessConfigUpdated: "doc-v1-business-config-updated",
  generalInfoUpdated: "doc-v1-general-info-updated",
  emailConfigUpdated: "doc-v1-email-config-updated",
  emailTemplatesUpdated: "doc-v1-email-templates-updated",
  notificationsUpdated: "doc-v1-notifications-updated",
  exportsUpdated: "doc-v1-exports-updated",
  unitsUpdated: "doc-v1-units-updated",
} as const;

const DEFAULT_TENANT_ID = "demo-company";
const ACTIVE_TENANT_KEY = "doc-v1-active-tenant";
const DOCUMENTS_VIEW_KEY = "documents-view-mode";
const CLIENTS_KEY = "clients";
const ARTICLES_KEY = "articles";
const DOCUMENTS_KEY = "documents";
const BUSINESS_CONFIG_KEY = "business-config";
const GENERAL_INFO_KEY = "general-info";
const EMAIL_CONFIG_KEY = "email-config";
const EMAIL_TEMPLATES_KEY = "email-templates";
const NOTIFICATIONS_KEY = "notifications";
const EXPORTS_KEY = "exports";
const UNITS_KEY = "units";

type BusinessConfig = {
  enabledDocumentTypes: DocumentType[];
  defaultTvaRate: number;
};

const DEFAULT_LINE_COLUMNS: TemplateLineColumn[] = [
  { id: "designation", label: "Designation", dataType: "text", required: true, enabled: true, system: true },
  { id: "unite", label: "Unite", dataType: "unit", required: false, enabled: true, system: true },
  { id: "qte", label: "Qte", dataType: "number", required: true, enabled: true, system: true },
  { id: "pu", label: "P.U HT", dataType: "currency", required: true, enabled: true, system: true },
  { id: "pt", label: "P.T HT", dataType: "currency", required: false, enabled: true, system: true },
];
const DEFAULT_BUSINESS_CONFIG: BusinessConfig = {
  enabledDocumentTypes: [...DOCUMENT_TYPE_OPTIONS],
  defaultTvaRate: 20,
};
const DEFAULT_GENERAL_INFO: GeneralInfoSettings = {
  legalName: "",
  ice: "",
  ifNumber: "",
  phoneFix: "",
  address: "",
  bank: "",
  language: "fr",
};
const DEFAULT_EMAIL_CONFIG: EmailConfigSettings = {
  mode: "gmail",
  smtpHost: "smtp.gmail.com",
  smtpPort: "587",
  smtpUser: "",
  smtpPassword: "",
  senderName: "",
  senderEmail: "",
};
const DEFAULT_EMAIL_TEMPLATES: EmailTemplateSettings = {
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
const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  dueSoonDays: "3",
  overdueDays: "1",
  reminderTime: "09:00",
};
const DEFAULT_EXPORTS: ExportSettings = {
  enabledFormats: ["PDF", "DOCX", "XLSX"],
  defaultFormat: "PDF",
  outputFolder: "exports",
  includeAttachments: false,
};
const DEFAULT_UNITS: UnitSettings = ["u", "kg", "m", "m2", "m3", "h", "jour", "forfait"];

function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function normalizeTenantId(input: string) {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || DEFAULT_TENANT_ID;
}

function getTenantId() {
  if (typeof window === "undefined") {
    return DEFAULT_TENANT_ID;
  }
  const existing = window.localStorage.getItem(ACTIVE_TENANT_KEY);
  if (existing && existing.trim().length > 1) {
    return normalizeTenantId(existing);
  }
  window.localStorage.setItem(ACTIVE_TENANT_KEY, DEFAULT_TENANT_ID);
  return DEFAULT_TENANT_ID;
}

function tenantKey(name: string) {
  return `doc-v1:${getTenantId()}:${name}`;
}

function readJson<T>(name: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(tenantKey(name));
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(name: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(tenantKey(name), JSON.stringify(value));
}

function normalizeColumn(column: TemplateLineColumn): TemplateLineColumn {
  const cleanId = column.id.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
  const isDesignation = cleanId === "designation";
  const isUnit = cleanId === "unite";
  const dataType: ColumnDataType =
    column.dataType === "number" || column.dataType === "currency" || column.dataType === "unit" ? column.dataType : "text";
  return {
    id: cleanId || "custom_col",
    label: column.label.trim() || "Custom",
    dataType: isUnit ? "unit" : dataType,
    enabled: isDesignation ? true : column.enabled,
    required: isDesignation ? true : column.required,
    system: isDesignation || isUnit ? true : column.system,
  };
}

function parseNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function sanitizeTvaRate(rate: number) {
  if (rate < 0) {
    return 0;
  }
  if (rate > 100) {
    return 100;
  }
  return Number(rate.toFixed(2));
}

function sanitizeDocumentTypes(input: unknown): DocumentType[] {
  if (!Array.isArray(input)) {
    return [...DOCUMENT_TYPE_OPTIONS];
  }
  const values = input.filter((item): item is DocumentType => DOCUMENT_TYPE_OPTIONS.includes(item as DocumentType));
  if (values.length === 0) {
    return [...DOCUMENT_TYPE_OPTIONS];
  }
  return [...new Set(values)];
}

function sanitizeDocumentStatus(input: unknown): DocumentStatus {
  if (typeof input !== "string") {
    return "DRAFT";
  }
  return DOCUMENT_STATUS_OPTIONS.includes(input as DocumentStatus) ? (input as DocumentStatus) : "DRAFT";
}

function sanitizeExportFormats(input: unknown): ExportFormatOption[] {
  if (!Array.isArray(input)) {
    return [...DEFAULT_EXPORTS.enabledFormats];
  }
  const valid = input.filter((item): item is ExportFormatOption => item === "PDF" || item === "DOCX" || item === "XLSX");
  if (valid.length === 0) {
    return [...DEFAULT_EXPORTS.enabledFormats];
  }
  return [...new Set(valid)];
}

function sanitizeUnits(input: unknown): UnitSettings {
  if (!Array.isArray(input)) {
    return [...DEFAULT_UNITS];
  }
  const normalized = input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
  const unique = Array.from(new Set(normalized));
  if (unique.length === 0) {
    return [...DEFAULT_UNITS];
  }
  return unique;
}

function sanitizeEmailConfigMode(input: unknown): EmailConfigMode {
  if (input === "gmail" || input === "host") {
    return input;
  }
  return "gmail";
}

function inferEmailConfigMode(inputMode: unknown, smtpHost: string): EmailConfigMode {
  if (inputMode === "gmail" || inputMode === "host") {
    return inputMode;
  }
  const normalizedHost = (smtpHost || "").trim().toLowerCase();
  if (!normalizedHost || normalizedHost.includes("gmail")) {
    return "gmail";
  }
  return "host";
}

export function emitWorkspaceEvent(eventName: (typeof STORE_EVENTS)[keyof typeof STORE_EVENTS]) {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(eventName));
}

export function getBusinessConfig(): BusinessConfig {
  const raw = readJson<Partial<BusinessConfig>>(BUSINESS_CONFIG_KEY, DEFAULT_BUSINESS_CONFIG);
  return {
    enabledDocumentTypes: sanitizeDocumentTypes(raw.enabledDocumentTypes),
    defaultTvaRate: sanitizeTvaRate(parseNumber(raw.defaultTvaRate, DEFAULT_BUSINESS_CONFIG.defaultTvaRate)),
  };
}

export function saveBusinessConfig(config: Partial<BusinessConfig>) {
  const current = getBusinessConfig();
  const next: BusinessConfig = {
    enabledDocumentTypes: sanitizeDocumentTypes(config.enabledDocumentTypes ?? current.enabledDocumentTypes),
    defaultTvaRate: sanitizeTvaRate(parseNumber(config.defaultTvaRate ?? current.defaultTvaRate, current.defaultTvaRate)),
  };
  writeJson(BUSINESS_CONFIG_KEY, next);
  emitWorkspaceEvent(STORE_EVENTS.businessConfigUpdated);
}

export function listEnabledDocumentTypes() {
  return getBusinessConfig().enabledDocumentTypes;
}

export function getDefaultTvaRate() {
  return getBusinessConfig().defaultTvaRate;
}

function sanitizeStringRecord<T extends Record<string, string>>(input: Partial<T>, defaults: T): T {
  const output: Record<string, string> = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const value = input[key as keyof T];
    output[key] = typeof value === "string" ? value : defaults[key as keyof T];
  }
  return output as T;
}

export function getGeneralInfoSettings() {
  const raw = readJson<Partial<GeneralInfoSettings>>(GENERAL_INFO_KEY, DEFAULT_GENERAL_INFO);
  const values = sanitizeStringRecord(raw, DEFAULT_GENERAL_INFO);
  const language = values.language === "ar" || values.language === "en" || values.language === "fr" ? values.language : "fr";
  return {
    ...values,
    language,
  };
}

export function saveGeneralInfoSettings(settings: Partial<GeneralInfoSettings>) {
  const next = sanitizeStringRecord(settings, getGeneralInfoSettings());
  writeJson(GENERAL_INFO_KEY, next);
  if (typeof document !== "undefined") {
    document.cookie = `${APP_LOCALE_COOKIE}=${next.language}; path=/; max-age=31536000; SameSite=Lax`;
  }
  emitWorkspaceEvent(STORE_EVENTS.generalInfoUpdated);
}

export function getEmailConfigSettings() {
  const raw = readJson<Partial<EmailConfigSettings>>(EMAIL_CONFIG_KEY, DEFAULT_EMAIL_CONFIG);
  const values = sanitizeStringRecord(raw, DEFAULT_EMAIL_CONFIG);
  const mode = inferEmailConfigMode(raw.mode, values.smtpHost);
  const smtpHost = mode === "gmail" ? "smtp.gmail.com" : values.smtpHost;
  const smtpPort = mode === "gmail" ? values.smtpPort || "587" : values.smtpPort;
  const senderEmail = values.senderEmail || (mode === "gmail" ? values.smtpUser : "");
  return {
    ...values,
    mode,
    smtpHost,
    smtpPort,
    senderEmail,
  };
}

export function saveEmailConfigSettings(settings: Partial<EmailConfigSettings>) {
  const current = getEmailConfigSettings();
  const next = sanitizeStringRecord(settings, current);
  const mode = sanitizeEmailConfigMode(settings.mode ?? next.mode);
  const payload: EmailConfigSettings = {
    ...next,
    mode,
    smtpHost: mode === "gmail" ? "smtp.gmail.com" : next.smtpHost,
    smtpPort: mode === "gmail" ? next.smtpPort || "587" : next.smtpPort,
    senderEmail: next.senderEmail || (mode === "gmail" ? next.smtpUser : ""),
  };
  writeJson(EMAIL_CONFIG_KEY, payload);
  emitWorkspaceEvent(STORE_EVENTS.emailConfigUpdated);
}

function sanitizeEmailTemplateConfig(input: Partial<EmailTemplateConfig>, fallback: EmailTemplateConfig): EmailTemplateConfig {
  return {
    enabled: typeof input.enabled === "boolean" ? input.enabled : fallback.enabled,
    autoSendOnCreate: typeof input.autoSendOnCreate === "boolean" ? input.autoSendOnCreate : fallback.autoSendOnCreate,
    subject: typeof input.subject === "string" ? input.subject : fallback.subject,
    body: typeof input.body === "string" ? input.body : fallback.body,
  };
}

export function getEmailTemplateSettings(): EmailTemplateSettings {
  const raw = readJson<Partial<Record<DocumentType, Partial<EmailTemplateConfig>>>>(EMAIL_TEMPLATES_KEY, {});
  const output = {} as EmailTemplateSettings;
  for (const documentType of DOCUMENT_TYPE_OPTIONS) {
    output[documentType] = sanitizeEmailTemplateConfig(raw[documentType] || {}, DEFAULT_EMAIL_TEMPLATES[documentType]);
  }
  return output;
}

export function saveEmailTemplateSettings(settings: Partial<EmailTemplateSettings>) {
  const current = getEmailTemplateSettings();
  const next = {} as EmailTemplateSettings;
  for (const documentType of DOCUMENT_TYPE_OPTIONS) {
    next[documentType] = sanitizeEmailTemplateConfig(settings[documentType] || {}, current[documentType]);
  }
  writeJson(EMAIL_TEMPLATES_KEY, next);
  emitWorkspaceEvent(STORE_EVENTS.emailTemplatesUpdated);
}

export const EMAIL_TEMPLATE_VARIABLES = ["client_name", "document_number", "document_type", "total_ttc"] as const;

export function applyEmailTemplateVariables(template: string, variables: Record<string, string>) {
  let output = template;
  for (const [key, value] of Object.entries(variables)) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    output = output.replace(new RegExp(`{{\\s*${escaped}\\s*}}`, "g"), value);
  }
  return output;
}

export function getNotificationSettings() {
  const raw = readJson<Partial<NotificationSettings>>(NOTIFICATIONS_KEY, DEFAULT_NOTIFICATIONS);
  return sanitizeStringRecord(raw, DEFAULT_NOTIFICATIONS);
}

export function saveNotificationSettings(settings: Partial<NotificationSettings>) {
  const current = getNotificationSettings();
  const next = sanitizeStringRecord(settings, current);
  writeJson(NOTIFICATIONS_KEY, next);
  emitWorkspaceEvent(STORE_EVENTS.notificationsUpdated);
}

export function getExportSettings() {
  const raw = readJson<Partial<ExportSettings>>(EXPORTS_KEY, DEFAULT_EXPORTS);
  const enabledFormats = sanitizeExportFormats(raw.enabledFormats);
  const defaultFormatRaw = raw.defaultFormat;
  const defaultFormat = (defaultFormatRaw && enabledFormats.includes(defaultFormatRaw)) ? defaultFormatRaw : enabledFormats[0];
  const outputFolder = typeof raw.outputFolder === "string" ? raw.outputFolder : DEFAULT_EXPORTS.outputFolder;
  return {
    enabledFormats,
    defaultFormat,
    outputFolder,
    includeAttachments: Boolean(raw.includeAttachments),
  } as ExportSettings;
}

export function saveExportSettings(settings: Partial<ExportSettings>) {
  const current = getExportSettings();
  const enabledFormats = sanitizeExportFormats(settings.enabledFormats ?? current.enabledFormats);
  const requestedDefault = settings.defaultFormat ?? current.defaultFormat;
  const defaultFormat = enabledFormats.includes(requestedDefault) ? requestedDefault : enabledFormats[0];
  const outputFolder = typeof settings.outputFolder === "string" ? settings.outputFolder : current.outputFolder;
  const includeAttachments =
    typeof settings.includeAttachments === "boolean" ? settings.includeAttachments : current.includeAttachments;
  const next: ExportSettings = {
    enabledFormats,
    defaultFormat,
    outputFolder,
    includeAttachments,
  };
  writeJson(EXPORTS_KEY, next);
  emitWorkspaceEvent(STORE_EVENTS.exportsUpdated);
}

export function listDocumentUnits() {
  const raw = readJson<UnitSettings>(UNITS_KEY, DEFAULT_UNITS);
  return sanitizeUnits(raw);
}

export function saveDocumentUnits(units: UnitSettings) {
  const next = sanitizeUnits(units);
  writeJson(UNITS_KEY, next);
  emitWorkspaceEvent(STORE_EVENTS.unitsUpdated);
}

export function listTemplateColumns(documentType: DocumentType) {
  const key = `template-columns:${documentType}`;
  const stored = readJson<TemplateLineColumn[]>(key, []);
  if (stored.length === 0) {
    return DEFAULT_LINE_COLUMNS;
  }

  const normalized = stored.map(normalizeColumn);
  const existingIds = new Set(normalized.map((column) => column.id));
  const merged = [...normalized];

  for (const systemColumn of DEFAULT_LINE_COLUMNS) {
    if (!existingIds.has(systemColumn.id)) {
      merged.push(systemColumn);
    }
  }

  return merged.map((column) => {
    if (column.id !== "designation") {
      return column;
    }
    return { ...column, enabled: true, required: true, system: true };
  });
}

export function saveTemplateColumns(documentType: DocumentType, columns: TemplateLineColumn[]) {
  const key = `template-columns:${documentType}`;
  const deduped: TemplateLineColumn[] = [];
  const seen = new Set<string>();
  for (const column of columns.map(normalizeColumn)) {
    if (seen.has(column.id)) {
      continue;
    }
    seen.add(column.id);
    deduped.push(column);
  }
  writeJson(key, deduped);
  emitWorkspaceEvent(STORE_EVENTS.templateColumnsUpdated);
}

export function listClients() {
  const rows = readJson<StoredClient[]>(CLIENTS_KEY, []);
  return [...rows].sort((a, b) => a.name.localeCompare(b.name));
}

export function upsertClient(input: DraftClientInput) {
  const name = input.name.trim();
  if (!name) {
    return null;
  }

  const now = new Date().toISOString();
  const rows = listClients();
  const existingIndex = rows.findIndex((client) => client.name.trim().toLowerCase() === name.toLowerCase());
  const payload: StoredClient = {
    id: existingIndex >= 0 ? rows[existingIndex].id : generateId(),
    name,
    email: input.email.trim(),
    phone: input.phone.trim(),
    address: input.address.trim(),
    ice: input.ice?.trim() || "",
    ifNumber: input.ifNumber?.trim() || "",
    createdAt: existingIndex >= 0 ? rows[existingIndex].createdAt : now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    rows[existingIndex] = payload;
  } else {
    rows.push(payload);
  }

  writeJson(CLIENTS_KEY, rows);
  emitWorkspaceEvent(STORE_EVENTS.clientsUpdated);
  return payload;
}

export function listArticles() {
  const rows = readJson<StoredArticle[]>(ARTICLES_KEY, []);
  return [...rows].sort((a, b) => a.designation.localeCompare(b.designation));
}

export function findArticleByDesignation(designation: string) {
  const needle = designation.trim().toLowerCase();
  if (!needle) {
    return null;
  }
  const rows = listArticles();
  return rows.find((article) => article.designation.trim().toLowerCase() === needle) ?? null;
}

export function upsertArticle(values: Record<string, string>) {
  const designation = (values.designation || "").trim();
  if (!designation) {
    return null;
  }

  const now = new Date().toISOString();
  const rows = listArticles();
  const existingIndex = rows.findIndex((article) => article.designation.trim().toLowerCase() === designation.toLowerCase());

  const payload: StoredArticle = {
    id: existingIndex >= 0 ? rows[existingIndex].id : generateId(),
    designation,
    values: {
      ...(existingIndex >= 0 ? rows[existingIndex].values : {}),
      ...values,
      designation,
    },
    createdAt: existingIndex >= 0 ? rows[existingIndex].createdAt : now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    rows[existingIndex] = payload;
  } else {
    rows.push(payload);
  }

  writeJson(ARTICLES_KEY, rows);
  emitWorkspaceEvent(STORE_EVENTS.articlesUpdated);
  return payload;
}

function formatMoney(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(2)} MAD`;
}

function nextDocumentNumber(type: DocumentType, rows: StoredDocument[]) {
  const prefixes: Record<DocumentType, string> = {
    DEVIS: "DEV",
    FACTURE: "FAC",
    FACTURE_PROFORMA: "PRO",
    BON_LIVRAISON: "BL",
    BON_COMMANDE: "BC",
    EXTRACT_DEVIS: "EDV",
    EXTRACT_BON_COMMANDE_PUBLIC: "EBCP",
  };
  const year = new Date().getFullYear();
  const prefix = prefixes[type];
  const count = rows.filter((row) => row.type === type && row.number.includes(`-${year}-`)).length;
  const seq = String(count + 1).padStart(5, "0");
  return `${prefix}-${year}-${seq}`;
}

export function listDocuments() {
  const rows = readJson<StoredDocument[]>(DOCUMENTS_KEY, []);
  return [...rows]
    .map((row) => ({
      ...row,
      status: sanitizeDocumentStatus(row.status),
    }))
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate));
}

export function addDocumentDraft(input: {
  type: DocumentType;
  client: string;
  total: number;
  number?: string;
  status?: DocumentStatus;
  issueDate?: string;
}) {
  const rows = listDocuments();
  const now = input.issueDate || new Date().toISOString();
  const payload: StoredDocument = {
    id: generateId(),
    number: input.number || nextDocumentNumber(input.type, rows),
    type: input.type,
    client: input.client.trim(),
    status: input.status || "DRAFT",
    total: formatMoney(input.total),
    issueDate: now,
  };
  rows.push(payload);
  writeJson(DOCUMENTS_KEY, rows);
  emitWorkspaceEvent(STORE_EVENTS.documentsUpdated);
  return payload;
}

export function updateDocumentStatus(documentId: string, status: DocumentStatus) {
  const rows = listDocuments();
  const index = rows.findIndex((row) => row.id === documentId);
  if (index < 0) {
    return null;
  }

  const next = [...rows];
  next[index] = { ...next[index], status };
  writeJson(DOCUMENTS_KEY, next);
  emitWorkspaceEvent(STORE_EVENTS.documentsUpdated);
  return next[index];
}

export function removeDocument(documentId: string) {
  const rows = listDocuments();
  const next = rows.filter((row) => row.id !== documentId);
  if (next.length === rows.length) {
    return false;
  }
  writeJson(DOCUMENTS_KEY, next);
  emitWorkspaceEvent(STORE_EVENTS.documentsUpdated);
  return true;
}

export function getDocumentsViewMode(): DocumentViewMode {
  if (typeof window === "undefined") {
    return "table";
  }
  const raw = window.localStorage.getItem(tenantKey(DOCUMENTS_VIEW_KEY));
  return raw === "grid" ? "grid" : "table";
}

export function setDocumentsViewMode(mode: DocumentViewMode) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(tenantKey(DOCUMENTS_VIEW_KEY), mode);
}
