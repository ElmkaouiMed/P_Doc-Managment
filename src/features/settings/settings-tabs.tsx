"use client";

import { CloudUploadIcon, FileExportIcon, HierarchyFilesIcon, LayoutTemplate, LegalDocument02Icon } from "@hugeicons/core-free-icons";
import { useEffect, useMemo, useRef, useState } from "react";

import { FormField } from "@/components/ui/form-field";
import { HugIcon } from "@/components/ui/hug-icon";
import { useMsgBox } from "@/components/ui/msg-box";
import { useToast } from "@/components/ui/toast";
import { UiButton } from "@/components/ui/ui-button";
import {
  applyEmailTemplateVariables,
  ColumnDataType,
  DOCUMENT_TYPE_OPTIONS,
  EmailConfigMode,
  DocumentType,
  EMAIL_TEMPLATE_VARIABLES,
  EmailConfigSettings,
  EmailTemplateSettings,
  ExportFormatOption,
  ExportSettings,
  GeneralInfoSettings,
  emitWorkspaceEvent,
  STORE_EVENTS,
  TemplateLineColumn,
} from "@/features/documents/lib/workspace-store";
import { NotificationConfigInput } from "@/features/notifications/config";
import {
  getCompanyNotificationConfigAction,
  saveCompanyNotificationConfigAction,
} from "@/features/notifications/actions";
import {
  deleteTemplateAssetAction,
  listTemplateAssetsAction,
  setDefaultTemplateAssetAction,
  uploadTemplateAssetAction,
  type TemplateAssetRow,
} from "@/features/templates/actions";
import {
  getCompanyBusinessConfigAction,
  getCompanyDocumentUnitsAction,
  getCompanyEmailConfigAction,
  getCompanyEmailTemplatesAction,
  getCompanyExportSettingsAction,
  getCompanyGeneralInfoAction,
  getCompanyTemplateColumnsAction,
  saveCompanyBusinessConfigAction,
  saveCompanyDocumentUnitsAction,
  saveCompanyEmailConfigAction,
  saveCompanyEmailTemplatesAction,
  saveCompanyExportSettingsAction,
  saveCompanyGeneralInfoAction,
  saveCompanyTemplateColumnsAction,
} from "@/features/settings/actions";
import { APP_LOCALE_COOKIE } from "@/i18n/constants";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const tabs = [
  { key: "config", labelKey: "settings.tabs.config" },
  { key: "general", labelKey: "settings.tabs.general" },
  { key: "emails", labelKey: "settings.tabs.emails" },
  { key: "templates", labelKey: "settings.tabs.templates" },
  { key: "exports", labelKey: "settings.tabs.exports" },
  { key: "notifications", labelKey: "settings.tabs.notifications" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export function SettingsTabs() {
  const [active, setActive] = useState<TabKey>("general");
  const { t } = useI18n();

  return (
    <section className="space-y-4">
      <div className="grid gap-2 rounded-md border border-border bg-card/70 p-2 sm:grid-cols-3 lg:grid-cols-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={cn(
              "rounded-sm px-3 py-2 text-xs font-semibold transition",
              active === tab.key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {active === "config" ? <ConfigTab /> : null}
      {active === "general" ? <GeneralInfoTab /> : null}
      {active === "emails" ? <EmailTab /> : null}
      {active === "templates" ? <TemplatesTab /> : null}
      {active === "exports" ? <ExportsTab /> : null}
      {active === "notifications" ? <NotificationsTab /> : null}
    </section>
  );
}

const documentTypeIcons: Record<DocumentType, unknown> = {
  DEVIS: LayoutTemplate,
  FACTURE: FileExportIcon,
  FACTURE_PROFORMA: FileExportIcon,
  BON_LIVRAISON: CloudUploadIcon,
  BON_COMMANDE: HierarchyFilesIcon,
  EXTRACT_DEVIS: LayoutTemplate,
  EXTRACT_BON_COMMANDE_PUBLIC: HierarchyFilesIcon,
};

const DOCUMENT_TYPE_I18N_KEYS: Record<DocumentType, string> = {
  DEVIS: "documents.types.devis",
  FACTURE: "documents.types.facture",
  FACTURE_PROFORMA: "documents.types.factureProforma",
  BON_LIVRAISON: "documents.types.bonLivraison",
  BON_COMMANDE: "documents.types.bonCommande",
  EXTRACT_DEVIS: "documents.types.extractDevis",
  EXTRACT_BON_COMMANDE_PUBLIC: "documents.types.extractBonCommandePublic",
};

const CONFIGURABLE_DOCUMENT_TYPES: DocumentType[] = DOCUMENT_TYPE_OPTIONS.filter(
  (documentType) => documentType !== "EXTRACT_DEVIS" && documentType !== "EXTRACT_BON_COMMANDE_PUBLIC",
);

const TEMPLATE_VARIABLE_BASE_GROUPS = [
  {
    labelKey: "settings.templates.files.variables.groups.client",
    values: ["client.name", "client.email", "client.phone", "client.address", "client.ice", "client.if_number"],
  },
  {
    labelKey: "settings.templates.files.variables.groups.document",
    values: ["document.number", "document.type", "document.status", "document.issue_date", "document.due_date", "document.currency"],
  },
  {
    labelKey: "settings.templates.files.variables.groups.totals",
    values: ["totals.subtotal_ht", "totals.total_tax", "totals.total_ttc", "totals.total_ttc_in_words", "totals.amount_paid", "totals.amount_due", "totals.tva_rate"],
  },
  {
    labelKey: "settings.templates.files.variables.groups.company",
    values: ["company.legal_name", "company.ice", "company.if_number", "company.address", "company.phone_fix", "company.bank"],
  },
] as const;

const COLUMN_DATA_TYPE_OPTION_KEYS: Array<{ value: ColumnDataType; labelKey: string }> = [
  { value: "text", labelKey: "settings.templates.dataType.text" },
  { value: "number", labelKey: "settings.templates.dataType.number" },
  { value: "currency", labelKey: "settings.templates.dataType.currency" },
  { value: "unit", labelKey: "settings.templates.dataType.unit" },
  { value: "select", labelKey: "settings.templates.dataType.select" },
  { value: "image", labelKey: "settings.templates.dataType.image" },
];

function parseSelectOptionsText(value: string) {
  const normalized = value
    .split(/[,\n]/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return Array.from(new Set(normalized));
}

function selectOptionsToText(options: string[] | undefined) {
  if (!options?.length) {
    return "";
  }
  return options.join(", ");
}

function lineVariableNamesFromColumns(columns: TemplateLineColumn[]) {
  const output = [
    "line.designation",
    "line.unit",
    "line.quantity",
    "line.unit_price_ht",
    "line.total_ht",
    "line.total_ttc",
    "line.vat_rate",
    "line.sku",
    "line.description",
  ];

  for (const column of columns) {
    if (!column.enabled) {
      continue;
    }
    output.push(`line.${column.id}`);
    if (column.id === "unite") {
      output.push("line.unit");
    }
    if (column.id === "qte") {
      output.push("line.quantity");
    }
    if (column.id === "pu") {
      output.push("line.unit_price_ht");
    }
    if (column.id === "pt") {
      output.push("line.total_ht");
    }
  }

  return Array.from(new Set(output));
}

const DOCX_TABLE_ROW_SNIPPET = `DOCX safe pattern (use 3 rows):
Row A (control row, first cell only): {%tr for row in lines %}
Row B (data row):
  Cell 1: {{ row.designation }}
  Cell 2: {{ row.unit }}
  Cell 3: {{ row.quantity }}
  Cell 4: {{ row.unit_price_ht }}
  Cell 5: {{ row.total_ht }}
Row C (control row, first cell only): {%tr endfor %}`;

const XLSX_TABLE_ROW_SNIPPET = `A2: {%row for row in lines %}{{ row.designation }}
B2: {{ row.unit }}
C2: {{ row.quantity }}
D2: {{ row.unit_price_ht }}
E2: {{ row.total_ht }}{%row endfor %}`;

const HTML_TABLE_ROW_SNIPPET = `{% for row in lines %}
<tr>
  <td>{{ row.designation }}</td>
  <td>{{ row.unit }}</td>
  <td>{{ row.quantity }}</td>
  <td>{{ row.unit_price_ht }}</td>
  <td>{{ row.total_ht }}</td>
</tr>
{% endfor %}`;

const DOCX_TOTALS_SNIPPET = `Total HT: {{ totals.subtotal_ht }}
Total TVA ({{ totals.tva_rate }}%): {{ totals.total_tax }}
Total TTC: {{ totals.total_ttc }}`;

function ConfigTab() {
  const { success, error } = useToast();
  const { t } = useI18n();
  const documentTypeLabel = (documentType: DocumentType) => t(DOCUMENT_TYPE_I18N_KEYS[documentType] || "documents.types.devis");
  const [enabledTypes, setEnabledTypes] = useState<DocumentType[]>(() => [...CONFIGURABLE_DOCUMENT_TYPES]);
  const [defaultTvaRate, setDefaultTvaRate] = useState("20");
  const [autoFillArticleUnitPrice, setAutoFillArticleUnitPrice] = useState(true);

  useEffect(() => {
    let mounted = true;
    void getCompanyBusinessConfigAction()
      .then((result) => {
        if (!mounted || !result.ok) {
          return;
        }
        setEnabledTypes(result.config.enabledDocumentTypes);
        setDefaultTvaRate(String(result.config.defaultTvaRate));
        setAutoFillArticleUnitPrice(result.config.autoFillArticleUnitPrice);
      })
      .catch(() => {
        error(t("settings.config.toasts.loadFailed"));
      });
    return () => {
      mounted = false;
    };
  }, [error, t]);

  const toggleType = (documentType: DocumentType) => {
    setEnabledTypes((current) => {
      if (current.includes(documentType)) {
        if (current.length === 1) {
          error(t("settings.config.toasts.oneTypeRequired"));
          return current;
        }
        return current.filter((item) => item !== documentType);
      }
      return [...current, documentType];
    });
  };

  const saveConfig = async () => {
    const parsedTva = Number.parseFloat(defaultTvaRate || "0");
    if (!Number.isFinite(parsedTva) || parsedTva < 0 || parsedTva > 100) {
      error(t("settings.config.toasts.invalidTva"), t("settings.config.toasts.invalidTvaHint"));
      return;
    }
    const nextConfig = {
      enabledDocumentTypes: enabledTypes,
      defaultTvaRate: parsedTva,
      autoFillArticleUnitPrice,
    };
    const result = await saveCompanyBusinessConfigAction(nextConfig);
    if (!result.ok) {
      error(t("settings.config.toasts.saveFailed"));
      return;
    }
    setEnabledTypes(result.config.enabledDocumentTypes);
    setDefaultTvaRate(String(result.config.defaultTvaRate));
    setAutoFillArticleUnitPrice(result.config.autoFillArticleUnitPrice);
    emitWorkspaceEvent(STORE_EVENTS.businessConfigUpdated);
    success(t("settings.config.toasts.saved"), t("settings.config.toasts.savedHint"));
  };

  return (
    <div className="space-y-4 rounded-md border border-border bg-card/60 p-4">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">{t("settings.config.title")}</h3>
        <p className="text-xs text-muted-foreground">
          {t("settings.config.subtitle")}
        </p>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {CONFIGURABLE_DOCUMENT_TYPES.map((documentType) => {
            const enabled = enabledTypes.includes(documentType);
            return (
              <button
                key={documentType}
                type="button"
                onClick={() => toggleType(documentType)}
                className={cn(
                  "flex items-center gap-3 rounded-md border px-3 py-2 text-left text-xs transition",
                  enabled ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
                )}
              >
                <HugIcon icon={documentTypeIcons[documentType]} size={16} />
                <span className="font-semibold">{documentTypeLabel(documentType)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2 rounded-md border border-border bg-background/20 p-3 md:max-w-sm">
        <FormField
          type="number"
          label={t("settings.config.defaultTva")}
          value={defaultTvaRate}
          min={0}
          max={100}
          step="0.01"
          onChange={setDefaultTvaRate}
        />
        <FormField
          type="checkbox"
          label={t("settings.config.autoFillArticlePrice")}
          checked={autoFillArticleUnitPrice}
          onCheckedChange={setAutoFillArticleUnitPrice}
        />
        <p className="text-[11px] text-muted-foreground">{t("settings.config.autoFillArticlePriceHint")}</p>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border bg-background/30 px-3 py-2">
        <p className="text-xs text-muted-foreground">{t("settings.config.defaultTvaHint")}</p>
        <UiButton type="button" size="sm" variant="primary" onClick={saveConfig}>
          {t("settings.config.save")}
        </UiButton>
      </div>
    </div>
  );
}

function GeneralInfoTab() {
  const { success, error } = useToast();
  const { t } = useI18n();
  const [values, setValues] = useState<GeneralInfoSettings>({
    legalName: "",
    ice: "",
    ifNumber: "",
    phoneFix: "",
    address: "",
    bank: "",
    language: "fr",
  });

  useEffect(() => {
    let mounted = true;
    void getCompanyGeneralInfoAction()
      .then((result) => {
        if (!mounted || !result.ok) {
          return;
        }
        const next = result.settings as GeneralInfoSettings;
        setValues(next);
        if (typeof document !== "undefined") {
          document.cookie = `${APP_LOCALE_COOKIE}=${next.language}; path=/; max-age=31536000; SameSite=Lax`;
        }
        emitWorkspaceEvent(STORE_EVENTS.generalInfoUpdated);
      })
      .catch(() => {
        error(t("settings.general.toasts.loadFailed"));
      });
    return () => {
      mounted = false;
    };
  }, [error, t]);

  const updateValue = (key: keyof GeneralInfoSettings, value: string) => {
    setValues((current) => ({ ...current, [key]: value } as GeneralInfoSettings));
    if (key === "language" && (value === "fr" || value === "en" || value === "ar")) {
      if (typeof document !== "undefined") {
        document.cookie = `${APP_LOCALE_COOKIE}=${value}; path=/; max-age=31536000; SameSite=Lax`;
      }
      emitWorkspaceEvent(STORE_EVENTS.generalInfoUpdated);
      void saveCompanyGeneralInfoAction({ language: value });
    }
  };

  const saveChanges = async () => {
    const result = await saveCompanyGeneralInfoAction(values);
    if (!result.ok) {
      error(t("settings.general.toasts.saveFailed"));
      return;
    }
    const next = result.settings as GeneralInfoSettings;
    setValues(next);
    if (typeof document !== "undefined") {
      document.cookie = `${APP_LOCALE_COOKIE}=${next.language}; path=/; max-age=31536000; SameSite=Lax`;
    }
    emitWorkspaceEvent(STORE_EVENTS.generalInfoUpdated);
    success(t("settings.general.toasts.saved"));
  };

  return (
    <div className="space-y-4 rounded-md border border-border bg-card/60 p-4">
      <div className="grid gap-4 md:grid-cols-3">
        <FormField type="text" label={t("settings.general.legalName")} value={values.legalName} onChange={(value) => updateValue("legalName", value)} placeholder={t("settings.general.placeholders.legalName")} />
        <FormField type="text" label={t("settings.general.ice")} value={values.ice} onChange={(value) => updateValue("ice", value)} placeholder={t("settings.general.placeholders.ice")} />
        <FormField type="text" label={t("settings.general.if")} value={values.ifNumber} onChange={(value) => updateValue("ifNumber", value)} placeholder={t("settings.general.placeholders.if")} />
        <FormField type="text" label={t("settings.general.phoneFix")} value={values.phoneFix} onChange={(value) => updateValue("phoneFix", value)} placeholder={t("settings.general.placeholders.phoneFix")} />
        <FormField type="text" label={t("settings.general.address")} value={values.address} onChange={(value) => updateValue("address", value)} placeholder={t("settings.general.placeholders.address")} />
        <FormField type="text" label={t("settings.general.bank")} value={values.bank} onChange={(value) => updateValue("bank", value)} placeholder={t("settings.general.placeholders.bank")} />
        <FormField
          type="select"
          label={t("settings.general.language")}
          value={values.language}
          onChange={(value) => updateValue("language", value)}
          options={[
            { value: "fr", label: t("settings.general.language.fr") },
            { value: "en", label: t("settings.general.language.en") },
            { value: "ar", label: t("settings.general.language.ar") },
          ]}
          className="md:col-span-3"
        />
      </div>
      <div className="flex justify-end">
        <UiButton type="button" size="sm" variant="primary" onClick={saveChanges}>
          {t("common.saveChanges")}
        </UiButton>
      </div>
    </div>
  );
}

function EmailTab() {
  const { success, error } = useToast();
  const { t } = useI18n();
  const documentTypeLabel = (documentType: DocumentType) => t(DOCUMENT_TYPE_I18N_KEYS[documentType] || "documents.types.devis");
  const [values, setValues] = useState<EmailConfigSettings>({
    mode: "gmail",
    smtpHost: "smtp.gmail.com",
    smtpPort: "587",
    smtpUser: "",
    smtpPassword: "",
    senderName: "",
    senderEmail: "",
  });
  const [emailSubTab, setEmailSubTab] = useState<"config" | "templates">("config");
  const [templateType, setTemplateType] = useState<DocumentType>("DEVIS");
  const [templates, setTemplates] = useState<EmailTemplateSettings>(() => {
    const output = {} as EmailTemplateSettings;
    for (const documentType of DOCUMENT_TYPE_OPTIONS) {
      output[documentType] = {
        enabled: true,
        autoSendOnCreate: false,
        subject: "",
        body: "",
      };
    }
    return output;
  });

  useEffect(() => {
    let mounted = true;
    void Promise.all([getCompanyEmailConfigAction(), getCompanyEmailTemplatesAction()])
      .then(([configResult, templatesResult]) => {
        if (!mounted) {
          return;
        }
        if (configResult.ok) {
          setValues(configResult.config as EmailConfigSettings);
        }
        if (templatesResult.ok) {
          setTemplates(templatesResult.templates as EmailTemplateSettings);
        }
      })
      .catch(() => {
        // Keep default settings when server load fails.
      });
    return () => {
      mounted = false;
    };
  }, []);

  const updateValue = (key: keyof EmailConfigSettings, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const updateMode = (mode: EmailConfigMode) => {
    setValues((current) => {
      if (mode === "gmail") {
        const smtpUser = current.smtpUser || current.senderEmail;
        return {
          ...current,
          mode,
          smtpHost: "smtp.gmail.com",
          smtpPort: current.smtpPort || "587",
          smtpUser,
          senderEmail: current.senderEmail || smtpUser,
        };
      }
      return {
        ...current,
        mode,
      };
    });
  };

  const saveChanges = async () => {
    try {
      const [configResult, templatesResult] = await Promise.all([
        saveCompanyEmailConfigAction(values),
        saveCompanyEmailTemplatesAction(templates),
      ]);
      if (!configResult.ok || !templatesResult.ok) {
        error(t("settings.emails.toasts.saveFailed"));
        return;
      }
      setTemplates(templatesResult.templates as EmailTemplateSettings);
      emitWorkspaceEvent(STORE_EVENTS.emailConfigUpdated);
      emitWorkspaceEvent(STORE_EVENTS.emailTemplatesUpdated);
    } catch {
      error(t("settings.emails.toasts.saveFailed"));
      return;
    }
    success(t("settings.emails.toasts.saved"));
  };

  const updateTemplate = (patch: Partial<EmailTemplateSettings[DocumentType]>) => {
    setTemplates((current) => ({
      ...current,
      [templateType]: {
        ...current[templateType],
        ...patch,
      },
    }));
  };

  const selectedTemplate = templates[templateType];
  const isGmailMode = values.mode === "gmail";
  const preview = applyEmailTemplateVariables(selectedTemplate.body, {
    client_name: "Client Demo",
    document_number: "DEV-2026-00001",
    document_type: documentTypeLabel(templateType),
    total_ttc: "1500.00 MAD",
  });

  return (
    <div className="space-y-4 rounded-md border border-border bg-card/60 p-4">
      <div className="grid gap-2 rounded-md border border-border bg-background/30 p-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setEmailSubTab("config")}
          className={cn(
            "rounded-sm px-3 py-2 text-xs font-semibold transition",
            emailSubTab === "config" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
          )}
        >
          {t("settings.emails.tabs.config")}
        </button>
        <button
          type="button"
          onClick={() => setEmailSubTab("templates")}
          className={cn(
            "rounded-sm px-3 py-2 text-xs font-semibold transition",
            emailSubTab === "templates" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
          )}
        >
          {t("settings.emails.tabs.templates")}
        </button>
      </div>

      {emailSubTab === "config" ? (
        <div className="space-y-3 rounded-md border border-border bg-background/20 p-3">
          <div className="space-y-2 rounded-md border border-border bg-background/30 p-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("settings.emails.mode")}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => updateMode("gmail")}
                className={cn(
                  "rounded-md border px-3 py-2 text-xs font-semibold transition",
                  values.mode === "gmail"
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-background/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {t("settings.emails.mode.gmail")}
              </button>
              <button
                type="button"
                onClick={() => updateMode("host")}
                className={cn(
                  "rounded-md border px-3 py-2 text-xs font-semibold transition",
                  values.mode === "host"
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-background/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {t("settings.emails.mode.host")}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {isGmailMode ? t("settings.emails.mode.gmailHint") : t("settings.emails.mode.hostHint")}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {isGmailMode ? (
              <>
                <FormField type="email" label={t("settings.emails.gmailAddress")} value={values.smtpUser} onChange={(value) => updateValue("smtpUser", value)} placeholder={t("settings.emails.placeholders.gmailAddress")} />
                <FormField type="password" label={t("settings.emails.gmailAppPassword")} value={values.smtpPassword} onChange={(value) => updateValue("smtpPassword", value)} placeholder={t("settings.emails.placeholders.gmailAppPassword")} />
              </>
            ) : (
              <>
                <FormField type="text" label={t("settings.emails.smtpHost")} value={values.smtpHost} onChange={(value) => updateValue("smtpHost", value)} placeholder={t("settings.emails.placeholders.smtpHost")} />
                <FormField type="number" label={t("settings.emails.smtpPort")} value={values.smtpPort} onChange={(value) => updateValue("smtpPort", value)} placeholder={t("settings.emails.placeholders.smtpPort")} />
                <FormField type="text" label={t("settings.emails.smtpUser")} value={values.smtpUser} onChange={(value) => updateValue("smtpUser", value)} placeholder={t("settings.emails.placeholders.smtpUser")} />
                <FormField type="password" label={t("settings.emails.smtpPassword")} value={values.smtpPassword} onChange={(value) => updateValue("smtpPassword", value)} placeholder={t("settings.emails.placeholders.smtpPassword")} />
              </>
            )}
            <FormField type="text" label={t("settings.emails.senderName")} value={values.senderName} onChange={(value) => updateValue("senderName", value)} placeholder={t("settings.emails.placeholders.senderName")} />
            <FormField type="email" label={t("settings.emails.senderEmail")} value={values.senderEmail} onChange={(value) => updateValue("senderEmail", value)} placeholder={t("settings.emails.placeholders.senderEmail")} />
            {isGmailMode ? (
              <div className="rounded-md border border-border bg-background/40 p-3 text-xs md:col-span-2">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background/60 text-muted-foreground">
                    <HugIcon icon={LegalDocument02Icon} size={14} />
                  </span>
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">{t("settings.emails.gmailHelp.title")}</p>
                    <p className="text-muted-foreground">{t("settings.emails.gmailHelp.description")}</p>
                    <p className="text-muted-foreground">{t("settings.emails.gmailHelp.path")}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <a
                        href="https://support.google.com/accounts/answer/185833"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex rounded-md border border-border bg-background/60 px-2 py-1 text-[11px] font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
                      >
                        {t("settings.emails.gmailHelp.guideLink")}
                      </a>
                      <a
                        href="https://myaccount.google.com/apppasswords"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex rounded-md border border-border bg-background/60 px-2 py-1 text-[11px] font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
                      >
                        {t("settings.emails.gmailHelp.pageLink")}
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {emailSubTab === "templates" ? (
        <div className="space-y-3 rounded-md border border-border bg-background/20 p-3">
          <p className="text-xs text-muted-foreground">{t("settings.emails.customTemplates")} {EMAIL_TEMPLATE_VARIABLES.map((item) => `{{${item}}}`).join(", ")}</p>
          <div className="grid gap-2 rounded-md border border-border bg-background/30 p-2 md:grid-cols-2 xl:grid-cols-4">
            {DOCUMENT_TYPE_OPTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTemplateType(item)}
                className={cn(
                  "flex items-center gap-2 rounded-sm border px-3 py-2 text-left text-xs font-semibold transition",
                  templateType === item ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-background/50 text-muted-foreground hover:text-foreground",
                )}
              >
                <HugIcon icon={documentTypeIcons[item]} size={14} />
                <span>{documentTypeLabel(item)}</span>
              </button>
            ))}
          </div>
          <div className="grid items-end gap-2 md:grid-cols-2">
            <FormField
              type="checkbox"
              label={t("settings.emails.enableForType")}
              checked={selectedTemplate.enabled}
              onCheckedChange={(checked) => updateTemplate({ enabled: checked })}
            />
            <FormField
              type="checkbox"
              label={t("settings.emails.autoSend")}
              checked={selectedTemplate.autoSendOnCreate}
              onCheckedChange={(checked) => updateTemplate({ autoSendOnCreate: checked })}
            />
          </div>
          <FormField
            type="text"
            label={t("settings.emails.subjectTemplate")}
            value={selectedTemplate.subject}
            onChange={(value) => updateTemplate({ subject: value })}
            placeholder={t("settings.emails.placeholders.subject")}
          />
          <label className="grid gap-1 text-xs">
            <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("settings.emails.bodyTemplate")}</span>
            <textarea
              value={selectedTemplate.body}
              onChange={(event) => updateTemplate({ body: event.target.value })}
              rows={6}
              className="w-full rounded-md border border-border bg-background/60 px-2 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:ring-1 focus:ring-primary/30 focus:outline-none transition"
              placeholder={t("settings.emails.placeholders.body")}
            />
          </label>
          <div className="rounded-md border border-border bg-background/40 p-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("settings.emails.preview")}</p>
            <p className="mt-1 text-xs font-semibold text-foreground">{applyEmailTemplateVariables(selectedTemplate.subject, {
              client_name: "Client Demo",
              document_number: "DEV-2026-00001",
              document_type: documentTypeLabel(templateType),
              total_ttc: "1500.00 MAD",
            })}</p>
            <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{preview}</p>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <UiButton type="button" size="sm" variant="primary" onClick={() => void saveChanges()}>
          {t("common.saveChanges")}
        </UiButton>
      </div>
    </div>
  );
}

function TemplatesTab() {
  const { success, error, info } = useToast();
  const { confirm } = useMsgBox();
  const { t } = useI18n();
  const documentTypeLabel = (documentType: DocumentType) => t(DOCUMENT_TYPE_I18N_KEYS[documentType] || "documents.types.devis");
  const [innerTab, setInnerTab] = useState<"files" | "columns" | "units">("files");
  const [documentType, setDocumentType] = useState<DocumentType>("DEVIS");
  const [columns, setColumns] = useState<TemplateLineColumn[]>([
    { id: "designation", label: "Designation", dataType: "text", required: true, enabled: true, system: true },
    { id: "unite", label: "Unite", dataType: "unit", required: false, enabled: true, system: true },
    { id: "qte", label: "Qte", dataType: "number", required: true, enabled: true, system: true },
    { id: "pu", label: "P.U HT", dataType: "currency", required: true, enabled: true, system: true },
    { id: "pt", label: "P.T HT", dataType: "currency", required: false, enabled: true, system: true },
  ]);
  const [units, setUnits] = useState<string[]>(["u", "kg", "m", "m2", "m3", "h", "jour", "forfait"]);
  const [newUnit, setNewUnit] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<ColumnDataType>("text");
  const [newSelectOptions, setNewSelectOptions] = useState("");
  const [newRequired, setNewRequired] = useState(false);
  const [templates, setTemplates] = useState<TemplateAssetRow[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateVariables, setTemplateVariables] = useState("");
  const [templateFormat, setTemplateFormat] = useState<"DOCX" | "XLSX" | "HTML">("DOCX");
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [markTemplateAsDefault, setMarkTemplateAsDefault] = useState(true);
  const [isDraggingTemplate, setIsDraggingTemplate] = useState(false);
  const templateFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;
    void getCompanyTemplateColumnsAction(documentType)
      .then((result) => {
        if (!mounted || !result.ok) {
          return;
        }
        setColumns(result.columns as TemplateLineColumn[]);
      })
      .catch(() => {
        error(t("settings.templates.toasts.loadFailed"));
      });
    return () => {
      mounted = false;
    };
  }, [documentType, error, t]);

  useEffect(() => {
    let mounted = true;
    void getCompanyDocumentUnitsAction()
      .then((result) => {
        if (!mounted || !result.ok) {
          return;
        }
        setUnits(result.units);
      })
      .catch(() => {
        error(t("settings.templates.toasts.unitsLoadFailed"));
      });
    return () => {
      mounted = false;
    };
  }, [error, t]);

  useEffect(() => {
    if (innerTab !== "files") {
      return;
    }
    setTemplatesLoading(true);
    void listTemplateAssetsAction({ documentType })
      .then((result) => {
        if (!result.ok) {
          error(t("settings.templates.files.toasts.loadFailed"), result.error);
          setTemplates([]);
          return;
        }
        setTemplates(result.rows);
      })
      .catch((e) => {
        const message = e instanceof Error ? e.message : "";
        error(t("settings.templates.files.toasts.loadFailed"), message);
      })
      .finally(() => setTemplatesLoading(false));
  }, [documentType, error, innerTab, t]);

  const customColumnsCount = useMemo(() => columns.filter((column) => !column.system).length, [columns]);
  const selectedTemplateVariables = useMemo(
    () =>
      new Set(
        templateVariables
          .split(/[,\n]/g)
          .map((item) => item.trim())
          .filter((item) => item.length > 0),
      ),
    [templateVariables],
  );
  const templateVariableGroups = useMemo(
    () => [
      ...TEMPLATE_VARIABLE_BASE_GROUPS,
      {
        labelKey: "settings.templates.files.variables.groups.lines",
        values: lineVariableNamesFromColumns(columns),
      },
    ],
    [columns],
  );

  const updateColumn = (columnId: string, patch: Partial<TemplateLineColumn>) => {
    setColumns((current) =>
      current.map((column) => {
        if (column.id !== columnId) {
          return column;
        }
        if (column.id === "designation") {
          return { ...column, enabled: true, required: true, system: true };
        }
        const next = { ...column, ...patch };
        if (next.dataType === "select") {
          return {
            ...next,
            selectOptions: parseSelectOptionsText(selectOptionsToText(next.selectOptions)),
          };
        }
        return {
          ...next,
          selectOptions: [],
        };
      }),
    );
  };

  const removeColumn = (columnId: string) => {
    setColumns((current) => current.filter((column) => column.id !== columnId || column.system));
    info(t("settings.templates.toasts.columnRemoved"));
  };

  const addCustomColumn = () => {
    const label = newLabel.trim();
    if (label.length < 2) {
      error(t("settings.templates.toasts.columnLabelShort"));
      return;
    }
    const id = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (!id) {
      error(t("settings.templates.toasts.columnLabelInvalid"));
      return;
    }
    if (columns.some((column) => column.id === id)) {
      error(t("settings.templates.toasts.columnExists"));
      return;
    }

    const selectOptions = newType === "select" ? parseSelectOptionsText(newSelectOptions) : [];

    setColumns((current) => [
      ...current,
      {
        id,
        label,
        dataType: newType,
        selectOptions,
        required: newRequired,
        enabled: true,
        system: false,
      },
    ]);
    setNewLabel("");
    setNewSelectOptions("");
    setNewRequired(false);
    setNewType("text");
    success(t("settings.templates.toasts.columnAdded"));
  };

  const saveColumns = async () => {
    const result = await saveCompanyTemplateColumnsAction({
      documentType,
      columns,
    });
    if (!result.ok) {
      error(t("settings.templates.toasts.saveFailed"));
      return;
    }
    setColumns(result.columns as TemplateLineColumn[]);
    emitWorkspaceEvent(STORE_EVENTS.templateColumnsUpdated);
    success(t("settings.templates.toasts.columnsSaved"), t("settings.templates.toasts.columnsSavedHint").replace("{type}", documentTypeLabel(documentType)));
  };

  const addUnit = () => {
    const next = newUnit.trim();
    if (next.length < 1) {
      error(t("settings.templates.toasts.unitRequired"));
      return;
    }
    if (units.some((unit) => unit.toLowerCase() === next.toLowerCase())) {
      error(t("settings.templates.toasts.unitExists"));
      return;
    }
    setUnits((current) => [...current, next]);
    setNewUnit("");
    info(t("settings.templates.toasts.unitAdded"));
  };

  const removeUnit = (unit: string) => {
    if (units.length <= 1) {
      error(t("settings.templates.toasts.oneUnitRequired"));
      return;
    }
    setUnits((current) => current.filter((item) => item !== unit));
    info(t("settings.templates.toasts.unitRemoved"));
  };

  const saveUnits = async () => {
    const result = await saveCompanyDocumentUnitsAction(units);
    if (!result.ok) {
      error(t("settings.templates.toasts.unitsSaveFailed"));
      return;
    }
    setUnits(result.units);
    emitWorkspaceEvent(STORE_EVENTS.unitsUpdated);
    success(t("settings.templates.toasts.unitsSaved"), t("settings.templates.toasts.unitsSavedHint").replace("{count}", String(result.units.length)));
  };

  const bytesLabel = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) {
      return "0 B";
    }
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  };

  const onTemplateFileChange = (file: File | null) => {
    setTemplateFile(file);
    if (!file) {
      return;
    }
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith(".docx")) {
      setTemplateFormat("DOCX");
      return;
    }
    if (lowerName.endsWith(".xlsx")) {
      setTemplateFormat("XLSX");
      return;
    }
    if (lowerName.endsWith(".html") || lowerName.endsWith(".htm")) {
      setTemplateFormat("HTML");
    }
  };

  const toggleTemplateVariable = (variableName: string) => {
    const current = Array.from(selectedTemplateVariables);
    const exists = selectedTemplateVariables.has(variableName);
    const next = exists ? current.filter((item) => item !== variableName) : [...current, variableName];
    setTemplateVariables(next.join(", "));
  };

  const clearTemplateVariables = () => {
    setTemplateVariables("");
  };

  const copyTemplateSnippet = async (value: string) => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(value);
      success(t("settings.templates.files.snippetCopied"));
    } catch {
      error(t("settings.templates.files.snippetCopyFailed"));
    }
  };

  const tableRowSnippet = templateFormat === "DOCX" ? DOCX_TABLE_ROW_SNIPPET : templateFormat === "XLSX" ? XLSX_TABLE_ROW_SNIPPET : HTML_TABLE_ROW_SNIPPET;

  const refreshTemplates = async () => {
    setTemplatesLoading(true);
    const result = await listTemplateAssetsAction({ documentType });
    setTemplatesLoading(false);
    if (!result.ok) {
      error(t("settings.templates.files.toasts.loadFailed"), result.error);
      return;
    }
    setTemplates(result.rows);
  };

  const uploadTemplate = async () => {
    if (!templateFile) {
      error(t("settings.templates.files.toasts.fileRequired"));
      return;
    }
    const formData = new FormData();
    formData.set("documentType", documentType);
    formData.set("name", templateName);
    formData.set("description", templateDescription);
    formData.set("variables", templateVariables);
    formData.set("format", templateFormat);
    formData.set("isDefault", markTemplateAsDefault ? "1" : "0");
    formData.set("file", templateFile);

    setUploadingTemplate(true);
    const result = await uploadTemplateAssetAction(formData);
    setUploadingTemplate(false);

    if (!result.ok) {
      error(t("settings.templates.files.toasts.uploadFailed"), result.error);
      return;
    }

    success(t("settings.templates.files.toasts.uploaded"), result.template.name);
    setTemplateName("");
    setTemplateDescription("");
    setTemplateVariables("");
    setTemplateFile(null);
    setMarkTemplateAsDefault(false);
    await refreshTemplates();
  };

  const setAsDefaultTemplate = async (templateId: string) => {
    const result = await setDefaultTemplateAssetAction({ templateId });
    if (!result.ok) {
      error(t("settings.templates.files.toasts.defaultFailed"), result.error);
      return;
    }
    success(t("settings.templates.files.toasts.defaultSet"));
    await refreshTemplates();
  };

  const deleteTemplate = async (templateId: string, templateNameValue: string) => {
    const shouldDelete = await confirm({
      title: t("settings.templates.files.confirmDeleteTitle"),
      description: t("settings.templates.files.confirmDeleteDescription").replace("{name}", templateNameValue),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
      variant: "danger",
    });
    if (!shouldDelete) {
      return;
    }

    const result = await deleteTemplateAssetAction({ templateId });
    if (!result.ok) {
      error(t("settings.templates.files.toasts.deleteFailed"), result.error);
      return;
    }
    success(t("settings.templates.files.toasts.deleted"));
    await refreshTemplates();
  };

  return (
    <div className="grid gap-3 rounded-md border border-border bg-card/60 p-4 text-xs">
      <p className="text-muted-foreground">
        {t("settings.templates.description")}
      </p>

      <div className="grid items-end gap-2 rounded-md border border-border bg-background/30 p-3 md:grid-cols-3">
        <FormField
          type="select"
          label={t("settings.templates.documentType")}
          value={documentType}
          onChange={(value) => setDocumentType(value as DocumentType)}
          options={DOCUMENT_TYPE_OPTIONS.map((item) => ({
            value: item,
            label: documentTypeLabel(item),
          }))}
          className="md:col-span-2"
        />
        <div className="rounded-md border border-border bg-card/70 p-3 text-[11px] text-muted-foreground">
          {t("settings.templates.customColumnsCount").replace("{count}", String(customColumnsCount))}
        </div>
      </div>

      <div className="grid gap-2 rounded-md border border-border bg-background/30 p-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setInnerTab("files")}
          className={cn(
            "rounded-sm px-3 py-2 text-xs font-semibold transition",
            innerTab === "files" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
          )}
        >
          {t("settings.templates.tabs.files")}
        </button>
        <button
          type="button"
          onClick={() => setInnerTab("columns")}
          className={cn(
            "rounded-sm px-3 py-2 text-xs font-semibold transition",
            innerTab === "columns" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
          )}
        >
          {t("settings.templates.tabs.columns")}
        </button>
        <button
          type="button"
          onClick={() => setInnerTab("units")}
          className={cn(
            "rounded-sm px-3 py-2 text-xs font-semibold transition",
            innerTab === "units" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
          )}
        >
          {t("settings.templates.tabs.units")}
        </button>
      </div>

      {innerTab === "files" ? (
        <div className="space-y-3 rounded-md border border-border bg-background/20 p-3">
          <div className="grid gap-3 md:grid-cols-2">
            <FormField
              type="text"
              label={t("settings.templates.files.templateName")}
              value={templateName}
              onChange={setTemplateName}
              placeholder={t("settings.templates.files.templateNamePlaceholder")}
            />
            <FormField
              type="select"
              label={t("settings.templates.files.format")}
              value={templateFormat}
              onChange={(value) => setTemplateFormat(value as "DOCX" | "XLSX" | "HTML")}
              options={[
                { value: "DOCX", label: "DOCX" },
                { value: "XLSX", label: "XLSX" },
                { value: "HTML", label: "HTML" },
              ]}
            />
            <FormField
              type="text"
              label={t("settings.templates.files.description")}
              value={templateDescription}
              onChange={setTemplateDescription}
              placeholder={t("settings.templates.files.descriptionPlaceholder")}
              className="md:col-span-2"
            />
            <p className="text-[11px] text-muted-foreground md:col-span-2">{t("settings.templates.files.variablesHelp")}</p>
            <div className="rounded-md border border-border bg-background/30 p-3 text-[11px] text-muted-foreground md:col-span-2">
              <p className="font-semibold text-foreground">{t("settings.templates.files.linesLoopHintTitle")}</p>
              <p className="mt-1">{t("settings.templates.files.linesLoopHintDescription")}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-border bg-background/60 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">{t("settings.templates.files.tableRowSnippetTitle")}</p>
                    <UiButton
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={() => void copyTemplateSnippet(tableRowSnippet)}
                    >
                      {t("settings.templates.files.copySnippet")}
                    </UiButton>
                  </div>
                  <pre className="mt-2 overflow-x-auto text-[11px] text-foreground">{tableRowSnippet}</pre>
                </div>
                <div className="rounded-md border border-border bg-background/60 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">{t("settings.templates.files.totalsSnippetTitle")}</p>
                    <UiButton
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={() => void copyTemplateSnippet(DOCX_TOTALS_SNIPPET)}
                    >
                      {t("settings.templates.files.copySnippet")}
                    </UiButton>
                  </div>
                  <pre className="mt-2 overflow-x-auto text-[11px] text-foreground">{DOCX_TOTALS_SNIPPET}</pre>
                </div>
              </div>
            </div>
            <div className="space-y-2 rounded-md border border-border bg-background/30 p-3 md:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("settings.templates.files.variablesLibrary")}</p>
                <UiButton type="button" size="xs" variant="ghost" onClick={clearTemplateVariables}>
                  {t("settings.templates.files.clearVariables")}
                </UiButton>
              </div>
              {templateVariableGroups.map((group) => (
                <div key={group.labelKey} className="space-y-1">
                  <p className="text-[11px] font-semibold text-foreground">{t(group.labelKey)}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.values.map((variableName) => (
                      <button
                        key={variableName}
                        type="button"
                        onClick={() => toggleTemplateVariable(variableName)}
                        className={cn(
                          "rounded-md border px-2 py-1 text-[11px] transition",
                          selectedTemplateVariables.has(variableName)
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-background/60 text-muted-foreground hover:text-foreground",
                        )}
                        title={`{{${variableName}}}`}
                      >
                        {`{{${variableName}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2 md:col-span-2">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("settings.templates.files.file")}</p>
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDraggingTemplate(true);
                }}
                onDragLeave={() => setIsDraggingTemplate(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDraggingTemplate(false);
                  const file = event.dataTransfer.files?.[0] ?? null;
                  onTemplateFileChange(file);
                }}
                className={cn(
                  "rounded-md border-2 border-dashed bg-background/40 p-4 transition",
                  isDraggingTemplate ? "border-primary/50 bg-primary/5" : "border-border",
                )}
              >
                <div className="flex flex-col items-center gap-2 text-center">
                  <HugIcon icon={CloudUploadIcon} size={18} />
                  <p className="text-xs font-semibold text-foreground">{t("settings.templates.files.uploaderTitle")}</p>
                  <p className="text-[11px] text-muted-foreground">{t("settings.templates.files.uploaderHint")}</p>
                  <UiButton
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => templateFileInputRef.current?.click()}
                  >
                    {templateFile ? t("settings.templates.files.replaceFile") : t("settings.templates.files.browseFiles")}
                  </UiButton>
                  <p className="text-[11px] text-muted-foreground">{t("settings.templates.files.acceptedFormats")}</p>
                </div>
                <input
                  ref={templateFileInputRef}
                  type="file"
                  accept=".docx,.xlsx,.html,.htm"
                  onChange={(event) => onTemplateFileChange(event.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </div>
              {templateFile ? (
                <div className="rounded-md border border-border bg-card/70 px-3 py-2 text-[11px] text-muted-foreground">
                  {t("settings.templates.files.selectedFile")}: <span className="font-semibold text-foreground">{templateFile.name}</span>
                </div>
              ) : null}
            </div>
            <FormField
              type="checkbox"
              label={t("settings.templates.files.defaultOnUpload")}
              checked={markTemplateAsDefault}
              onCheckedChange={setMarkTemplateAsDefault}
              className="md:col-span-2"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <UiButton type="button" size="sm" variant="ghost" onClick={() => void refreshTemplates()}>
              {t("settings.templates.files.refresh")}
            </UiButton>
            <UiButton type="button" size="sm" variant="primary" disabled={uploadingTemplate} onClick={() => void uploadTemplate()}>
              {t("settings.templates.files.upload")}
            </UiButton>
          </div>

          <div className="space-y-2 rounded-md border border-border bg-background/30 p-3">
            {templatesLoading ? (
              <p className="text-xs text-muted-foreground">{t("settings.templates.files.loading")}</p>
            ) : templates.length ? (
              templates.map((item) => (
                <article key={item.id} className="space-y-2 rounded-md border border-border bg-card/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.name}</p>
                      <p className="text-[11px] text-muted-foreground">{item.description || "-"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md border border-border px-2 py-1 text-[10px] text-muted-foreground">{item.format}</span>
                      {item.isDefault ? (
                        <span className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] text-primary">
                          {t("settings.templates.files.defaultBadge")}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid gap-2 text-[11px] text-muted-foreground md:grid-cols-3">
                    <p>{t("settings.templates.files.version")}: {item.versionNumber}</p>
                    <p>{t("settings.templates.files.fileName")}: {item.fileName || "-"}</p>
                    <p>{t("settings.templates.files.fileSize")}: {bytesLabel(item.fileSize)}</p>
                  </div>
                  {item.variables.length ? (
                    <p className="text-[11px] text-muted-foreground">
                      {t("settings.templates.files.variables")}: {item.variables.join(", ")}
                    </p>
                  ) : null}
                  <div className="flex items-center justify-end gap-2">
                    {!item.isDefault ? (
                      <UiButton type="button" size="xs" variant="outline" onClick={() => void setAsDefaultTemplate(item.id)}>
                        {t("settings.templates.files.makeDefault")}
                      </UiButton>
                    ) : null}
                    <UiButton type="button" size="xs" variant="danger" onClick={() => void deleteTemplate(item.id, item.name)}>
                      {t("common.delete")}
                    </UiButton>
                  </div>
                </article>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">{t("settings.templates.files.empty")}</p>
            )}
          </div>
        </div>
      ) : null}

      {innerTab === "columns" ? (
        <div className="space-y-2 rounded-md border border-border bg-background/20 p-3">
        <p className="text-muted-foreground">{t("settings.templates.lineColumns")}</p>
        {columns.map((column) => (
          <div key={column.id} className="grid items-end gap-2 rounded-sm border border-border bg-background/30 p-2 md:grid-cols-[1.2fr_1fr_1.4fr_auto_auto_auto]">
            <div className="text-foreground">
              <p className="font-semibold">{column.label}</p>
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{column.id}</p>
            </div>
            <FormField
              type="select"
              label={t("settings.templates.type")}
              value={column.dataType}
              disabled={column.system}
              onChange={(value) => updateColumn(column.id, { dataType: value as ColumnDataType })}
              options={COLUMN_DATA_TYPE_OPTION_KEYS.map((item) => ({
                value: item.value,
                label: t(item.labelKey),
              }))}
              className="text-[11px]"
            />
            <FormField
              type="text"
              label={t("settings.templates.dataType.selectOptions")}
              value={selectOptionsToText(column.selectOptions)}
              disabled={column.system || column.dataType !== "select"}
              onChange={(value) => updateColumn(column.id, { selectOptions: parseSelectOptionsText(value) })}
              placeholder={t("settings.templates.placeholders.selectOptions")}
              className="text-[11px]"
            />
            <FormField
              type="checkbox"
              label={t("settings.templates.enabled")}
              checked={column.enabled}
              disabled={column.id === "designation"}
              onCheckedChange={(checked) => updateColumn(column.id, { enabled: checked })}
              className="px-2 py-1.5 text-[11px]"
            />
            <FormField
              type="checkbox"
              label={t("settings.templates.required")}
              checked={column.required}
              disabled={column.id === "designation"}
              onCheckedChange={(checked) => updateColumn(column.id, { required: checked })}
              className="px-2 py-1.5 text-[11px]"
            />
            <UiButton type="button" size="sm" variant="danger" iconOnly iconName="remove" disabled={column.system} onClick={() => removeColumn(column.id)} />
          </div>
        ))}
        </div>
      ) : null}

      {innerTab === "columns" ? (
        <div className="space-y-2 rounded-md border border-border bg-background/20 p-3">
          <div className="grid items-end gap-2 md:grid-cols-[2fr_1fr_1fr_auto]">
            <FormField
              type="text"
              label={t("settings.templates.newColumnLabel")}
              value={newLabel}
              onChange={setNewLabel}
              placeholder={t("settings.templates.placeholders.newColumnLabel")}
            />
            <FormField
              type="select"
              label={t("settings.templates.dataType.label")}
              value={newType}
              onChange={(value) => setNewType(value as ColumnDataType)}
              options={COLUMN_DATA_TYPE_OPTION_KEYS.map((item) => ({
                value: item.value,
                label: t(item.labelKey),
              }))}
            />
            <FormField type="checkbox" label={t("settings.templates.required")} checked={newRequired} onCheckedChange={setNewRequired} />
            <UiButton type="button" size="sm" iconOnly iconName="plus" variant="outline" onClick={addCustomColumn}/>
          </div>
          {newType === "select" ? (
            <FormField
              type="text"
              label={t("settings.templates.dataType.selectOptions")}
              value={newSelectOptions}
              onChange={setNewSelectOptions}
              placeholder={t("settings.templates.placeholders.selectOptions")}
            />
          ) : null}
        </div>
      ) : null}

      {innerTab === "columns" ? (
        <div className="flex items-center justify-between rounded-md border border-border bg-background/30 px-3 py-2">
          <p className="text-muted-foreground">{t("settings.templates.exportHint")}</p>
          <UiButton type="button" size="sm" variant="primary" onClick={saveColumns}>
            {t("settings.templates.saveColumns")}
          </UiButton>
        </div>
      ) : null}

      {innerTab === "units" ? (
        <div className="space-y-3 rounded-md border border-border bg-background/20 p-3">
          <p className="text-muted-foreground">{t("settings.templates.units.title")}</p>
          <div className="flex flex-wrap gap-2">
            {units.map((unit) => (
              <span key={unit} className="inline-flex items-center gap-1 rounded-md border border-border bg-card/70 px-2 py-1 text-[11px] text-foreground">
                {unit}
                <UiButton type="button" size="xs" iconOnly iconName="remove" variant="ghost" aria-label={t("settings.templates.units.remove").replace("{unit}", unit)} onClick={() => removeUnit(unit)} />
              </span>
            ))}
          </div>
          <div className="grid items-end gap-2 md:grid-cols-[1fr_auto_auto]">
            <FormField type="text" label={t("settings.templates.units.newUnit")} value={newUnit} onChange={setNewUnit} placeholder={t("settings.templates.units.placeholder")} />
            <UiButton type="button" size="sm" iconName="plus" label={t("settings.templates.units.add")} variant="outline" onClick={addUnit} />
            <UiButton type="button" size="sm" variant="primary" onClick={saveUnits}>
              {t("settings.templates.units.save")}
            </UiButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NotificationsTab() {
  const { success, error } = useToast();
  const { t } = useI18n();
  const [values, setValues] = useState<NotificationConfigInput | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    void getCompanyNotificationConfigAction()
      .then((result) => {
        if (!mounted || !result.ok) {
          return;
        }
        setValues(result.config as NotificationConfigInput);
      })
      .catch(() => {
        error(t("settings.notifications.toasts.loadFailed"));
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [error, t]);

  const updateBoolean = (key: keyof NotificationConfigInput, checked: boolean) => {
    setValues((current) => (current ? { ...current, [key]: checked } : current));
  };

  const updateNumeric = (key: keyof NotificationConfigInput, value: string) => {
    const parsed = Number.parseInt(value || "0", 10);
    if (!Number.isFinite(parsed)) {
      return;
    }
    setValues((current) => (current ? { ...current, [key]: parsed } : current));
  };

  const updateText = (key: keyof NotificationConfigInput, value: string) => {
    setValues((current) => (current ? { ...current, [key]: value } : current));
  };

  const saveChanges = async () => {
    if (!values) {
      return;
    }

    if (
      !Number.isFinite(values.dueSoonDays) ||
      values.dueSoonDays < 0 ||
      !Number.isFinite(values.overdueDays) ||
      values.overdueDays < 0 ||
      !Number.isFinite(values.overdueRepeatDays) ||
      values.overdueRepeatDays < 1 ||
      !Number.isFinite(values.draftStaleDays) ||
      values.draftStaleDays < 1
    ) {
      error(t("settings.notifications.toasts.invalidValues"), t("settings.notifications.toasts.invalidValuesHint"));
      return;
    }

    if (!/^\d{2}:\d{2}$/.test(values.reminderTime) || !/^\d{2}:\d{2}$/.test(values.digestTime)) {
      error(t("settings.notifications.toasts.invalidValues"), t("settings.notifications.toasts.invalidTimeHint"));
      return;
    }

    try {
      const result = await saveCompanyNotificationConfigAction(values);
      if (!result.ok) {
        error(t("settings.notifications.toasts.saveFailed"));
        return;
      }
    } catch {
      error(t("settings.notifications.toasts.saveFailed"));
      return;
    }

    success(t("settings.notifications.toasts.saved"));
  };

  if (loading || !values) {
    return (
      <div className="space-y-4 rounded-md border border-border bg-card/60 p-4">
        <p className="text-xs text-muted-foreground">{t("settings.notifications.loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-md border border-border bg-card/60 p-4">
      <div className="space-y-2 rounded-md border border-border bg-background/20 p-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("settings.notifications.channels")}</p>
        <div className="grid gap-2 md:grid-cols-2">
          <FormField type="checkbox" label={t("settings.notifications.enabled")} checked={values.enabled} onCheckedChange={(checked) => updateBoolean("enabled", checked)} />
          <FormField type="checkbox" label={t("settings.notifications.inAppEnabled")} checked={values.inAppEnabled} onCheckedChange={(checked) => updateBoolean("inAppEnabled", checked)} />
          <FormField type="checkbox" label={t("settings.notifications.emailEnabled")} checked={values.emailEnabled} onCheckedChange={(checked) => updateBoolean("emailEnabled", checked)} />
          <FormField type="checkbox" label={t("settings.notifications.pushEnabled")} checked={values.pushEnabled} onCheckedChange={(checked) => updateBoolean("pushEnabled", checked)} />
        </div>
      </div>

      <div className="space-y-2 rounded-md border border-border bg-background/20 p-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("settings.notifications.triggers")}</p>
        <div className="grid gap-2 md:grid-cols-2">
          <FormField type="checkbox" label={t("settings.notifications.notifyDueSoon")} checked={values.notifyDueSoon} onCheckedChange={(checked) => updateBoolean("notifyDueSoon", checked)} />
          <FormField type="checkbox" label={t("settings.notifications.notifyOverdue")} checked={values.notifyOverdue} onCheckedChange={(checked) => updateBoolean("notifyOverdue", checked)} />
          <FormField type="checkbox" label={t("settings.notifications.notifyDraftStale")} checked={values.notifyDraftStale} onCheckedChange={(checked) => updateBoolean("notifyDraftStale", checked)} />
          <FormField type="checkbox" label={t("settings.notifications.notifyStatusChanges")} checked={values.notifyStatusChanges} onCheckedChange={(checked) => updateBoolean("notifyStatusChanges", checked)} />
          <FormField type="checkbox" label={t("settings.notifications.notifyEmailFailures")} checked={values.notifyEmailFailures} onCheckedChange={(checked) => updateBoolean("notifyEmailFailures", checked)} />
          <FormField type="checkbox" label={t("settings.notifications.notifyExportFailures")} checked={values.notifyExportFailures} onCheckedChange={(checked) => updateBoolean("notifyExportFailures", checked)} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          type="number"
          label={t("settings.notifications.dueSoonDays")}
          value={String(values.dueSoonDays)}
          min={0}
          onChange={(value) => updateNumeric("dueSoonDays", value)}
        />
        <FormField
          type="number"
          label={t("settings.notifications.overdueDays")}
          value={String(values.overdueDays)}
          min={0}
          onChange={(value) => updateNumeric("overdueDays", value)}
        />
        <FormField
          type="number"
          label={t("settings.notifications.overdueRepeatDays")}
          value={String(values.overdueRepeatDays)}
          min={1}
          onChange={(value) => updateNumeric("overdueRepeatDays", value)}
        />
        <FormField
          type="number"
          label={t("settings.notifications.draftStaleDays")}
          value={String(values.draftStaleDays)}
          min={1}
          onChange={(value) => updateNumeric("draftStaleDays", value)}
        />
        <FormField
          type="text"
          label={t("settings.notifications.reminderTime")}
          value={values.reminderTime}
          onChange={(value) => updateText("reminderTime", value)}
          placeholder="09:00"
        />
        <FormField
          type="checkbox"
          label={t("settings.notifications.digestEnabled")}
          checked={values.digestEnabled}
          onCheckedChange={(checked) => updateBoolean("digestEnabled", checked)}
        />
        <FormField
          type="text"
          label={t("settings.notifications.digestTime")}
          value={values.digestTime}
          onChange={(value) => updateText("digestTime", value)}
          placeholder="18:00"
          className="md:col-span-2"
        />
      </div>
      <div className="flex justify-end">
        <UiButton type="button" size="sm" variant="primary" onClick={saveChanges}>
          {t("common.saveChanges")}
        </UiButton>
      </div>
    </div>
  );
}

function ExportsTab() {
  const { success, error } = useToast();
  const { t } = useI18n();
  const [values, setValues] = useState<ExportSettings>({
    enabledFormats: ["PDF", "DOCX", "XLSX"],
    defaultFormat: "PDF",
    outputFolder: "exports",
    includeAttachments: false,
  });

  useEffect(() => {
    let mounted = true;
    void getCompanyExportSettingsAction()
      .then((result) => {
        if (!mounted || !result.ok) {
          return;
        }
        setValues(result.settings as ExportSettings);
      })
      .catch(() => {
        error(t("settings.exports.toasts.loadFailed"));
      });
    return () => {
      mounted = false;
    };
  }, [error, t]);

  const toggleFormat = (format: ExportFormatOption) => {
    setValues((current) => {
      const enabled = current.enabledFormats.includes(format)
        ? current.enabledFormats.filter((item) => item !== format)
        : [...current.enabledFormats, format];
      const normalized = enabled.length ? enabled : current.enabledFormats;
      const defaultFormat = normalized.includes(current.defaultFormat) ? current.defaultFormat : normalized[0];
      return {
        ...current,
        enabledFormats: normalized,
        defaultFormat,
      };
    });
  };

  const saveChanges = async () => {
    if (!values.enabledFormats.length) {
      error(t("settings.exports.toasts.oneFormatRequired"));
      return;
    }
    const result = await saveCompanyExportSettingsAction(values);
    if (!result.ok) {
      error(t("settings.exports.toasts.saveFailed"));
      return;
    }
    setValues(result.settings as ExportSettings);
    emitWorkspaceEvent(STORE_EVENTS.exportsUpdated);
    success(t("settings.exports.toasts.saved"));
  };

  return (
    <div className="space-y-4 rounded-md border border-border bg-card/60 p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-border bg-background/20 p-3">
          <p className="mb-2 text-xs text-muted-foreground">{t("settings.exports.enabledFormats")}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {(["PDF", "DOCX", "XLSX"] as ExportFormatOption[]).map((format) => (
              <FormField
                key={format}
                type="checkbox"
                label={format}
                checked={values.enabledFormats.includes(format)}
                onCheckedChange={() => toggleFormat(format)}
              />
            ))}
          </div>
        </div>
        <FormField
          type="select"
          label={t("settings.exports.defaultFormat")}
          value={values.defaultFormat}
          onChange={(value) => setValues((current) => ({ ...current, defaultFormat: value as ExportFormatOption }))}
          options={values.enabledFormats.map((format) => ({ value: format, label: format }))}
        />
        <FormField
          type="text"
          label={t("settings.exports.outputFolder")}
          value={values.outputFolder}
          onChange={(value) => setValues((current) => ({ ...current, outputFolder: value }))}
          placeholder="exports"
          className="md:col-span-2"
        />
        <FormField
          type="checkbox"
          label={t("settings.exports.includeAttachments")}
          checked={values.includeAttachments}
          onCheckedChange={(checked) => setValues((current) => ({ ...current, includeAttachments: checked }))}
          className="md:col-span-2"
        />
      </div>
      <div className="flex justify-end">
        <UiButton type="button" size="sm" variant="primary" onClick={saveChanges}>
          {t("common.saveChanges")}
        </UiButton>
      </div>
    </div>
  );
}
