"use client";

import { FileExportIcon, LayoutTable01Icon, LegalDocument02Icon } from "@hugeicons/core-free-icons";
import { useEffect, useMemo, useState } from "react";

import { FormField } from "@/components/ui/form-field";
import { HugIcon } from "@/components/ui/hug-icon";
import { useToast } from "@/components/ui/toast";
import { UiButton } from "@/components/ui/ui-button";
import { generateDocumentExportAction, listTemplateAssetsAction, type TemplateAssetRow } from "@/features/templates/actions";
import { emitWorkspaceEvent, ExportSettings, STORE_EVENTS } from "@/features/documents/lib/workspace-store";
import { DOCUMENT_TYPE_OPTIONS } from "@/features/documents/lib/workspace-store";
import { getCompanyExportSettingsAction } from "@/features/settings/actions";
import { useI18n } from "@/i18n/provider";

type DocumentType = (typeof DOCUMENT_TYPE_OPTIONS)[number];
type ExportFormat = "PDF" | "DOCX" | "XLSX";

type ExportDocumentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: {
    id: string;
    number: string;
    type: DocumentType;
  } | null;
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

const EXPORT_FORMAT_ICON_BY_VALUE: Record<ExportFormat, unknown> = {
  PDF: FileExportIcon,
  DOCX: LegalDocument02Icon,
  XLSX: LayoutTable01Icon,
};

function toTemplateFormat(value: ExportFormat) {
  if (value === "PDF" || value === "DOCX") {
    return "DOCX";
  }
  if (value === "XLSX") {
    return "XLSX";
  }
  return "DOCX";
}

function canDirectTemplatelessExport(documentType: DocumentType, format: ExportFormat) {
  if (format !== "XLSX") {
    return false;
  }
  return documentType === "EXTRACT_BON_COMMANDE_PUBLIC" || documentType === "EXTRACT_DEVIS";
}

export function ExportDocumentModal({ open, onOpenChange, document }: ExportDocumentModalProps) {
  const { t } = useI18n();
  const { success, error, info } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [templates, setTemplates] = useState<TemplateAssetRow[]>([]);
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    enabledFormats: ["PDF", "DOCX", "XLSX"],
    defaultFormat: "PDF",
    outputFolder: "exports",
    includeAttachments: false,
  });
  const [format, setFormat] = useState<ExportFormat>("PDF");
  const [templateId, setTemplateId] = useState<string>("");

  const formatOptions = useMemo(() => {
    const enabled = exportSettings.enabledFormats.length ? exportSettings.enabledFormats : ["PDF", "DOCX", "XLSX"];
    return enabled.map((item) => ({
      value: item,
      label: item,
    }));
  }, [exportSettings.enabledFormats]);

  useEffect(() => {
    if (!open || !document) {
      return;
    }
    void Promise.all([
      getCompanyExportSettingsAction(),
      listTemplateAssetsAction({ documentType: document.type }),
    ])
      .then(([settingsResult, templatesResult]) => {
        const nextSettings = settingsResult.ok
          ? settingsResult.settings as ExportSettings
          : {
              enabledFormats: ["PDF", "DOCX", "XLSX"],
              defaultFormat: "PDF" as const,
              outputFolder: "exports",
              includeAttachments: false,
            };
        setExportSettings(nextSettings);
        const defaultFormat = nextSettings.defaultFormat as ExportFormat;
        if (!templatesResult.ok) {
          error(t("documents.exportModal.toasts.loadTemplatesFailed"), templatesResult.error);
          setTemplates([]);
          setFormat(defaultFormat);
          setTemplateId("");
          return;
        }
        const rows = templatesResult.rows.filter((item) => item.isActive);
        setTemplates(rows);
        setFormat(defaultFormat);
        const targetFormat = toTemplateFormat(defaultFormat);
        const defaultByFormat = rows.find((item) => item.isDefault && item.format === targetFormat);
        const firstByFormat = rows.find((item) => item.format === targetFormat);
        const fallback = defaultByFormat || firstByFormat || rows.find((item) => item.isDefault) || rows[0];
        setTemplateId(fallback?.id || "");
      })
      .catch((e) => {
        const message = e instanceof Error ? e.message : "";
        error(t("documents.exportModal.toasts.loadTemplatesFailed"), message);
      });
  }, [document, error, open, t]);

  const matchingTemplates = useMemo(() => {
    const target = toTemplateFormat(format);
    return templates.filter((item) => item.format === target);
  }, [format, templates]);

  const effectiveTemplateId = useMemo(() => {
    if (!matchingTemplates.length) {
      return "";
    }
    if (matchingTemplates.some((item) => item.id === templateId)) {
      return templateId;
    }
    const preferred = matchingTemplates.find((item) => item.isDefault) || matchingTemplates[0];
    return preferred.id;
  }, [matchingTemplates, templateId]);

  if (!open || !document) {
    return null;
  }

  const submitExport = async () => {
    const canExportWithoutTemplate = canDirectTemplatelessExport(document.type, format);
    if (!matchingTemplates.length && !canExportWithoutTemplate) {
      error(t("documents.exportModal.toasts.queueFailed"), t("documents.exportModal.noTemplateHint"));
      return;
    }
    const selectedTemplateId = matchingTemplates.length ? effectiveTemplateId || "" : "";
    setSubmitting(true);
    const result = await generateDocumentExportAction({
      documentId: document.id,
      exportFormat: format,
      templateId: selectedTemplateId || null,
    });
    setSubmitting(false);

    if (!result.ok) {
      error(t("documents.exportModal.toasts.queueFailed"), result.error);
      return;
    }

    success(t("documents.exportModal.toasts.queued"), `${document.number} - ${format}`);
    if (result.downloadPath) {
      const anchor = window.document.createElement("a");
      anchor.href = result.downloadPath;
      anchor.download = result.fileName || "";
      anchor.style.display = "none";
      window.document.body.appendChild(anchor);
      anchor.click();
      window.document.body.removeChild(anchor);
      info(t("documents.exportModal.toasts.downloadStarted"), result.fileName || "");
    }
    emitWorkspaceEvent(STORE_EVENTS.documentsUpdated);
    onOpenChange(false);
  };

  const documentTypeLabel = t(DOCUMENT_TYPE_I18N_KEYS[document.type] || "documents.types.devis");
  const canExportWithoutTemplate = canDirectTemplatelessExport(document.type, format);
  const templateHintKey =
    !matchingTemplates.length && canExportWithoutTemplate
      ? "documents.exportModal.noTemplateDirectImportHint"
      : "documents.exportModal.noTemplateHint";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xl rounded-md border border-border bg-card/95 p-4 shadow-2xl shadow-black/50">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("documents.exportModal.tag")}</p>
            <h3 className="text-base font-semibold text-foreground">{t("documents.exportModal.title")}</h3>
            <p className="text-xs text-muted-foreground">
              {document.number} - {documentTypeLabel}
            </p>
          </div>
          <UiButton type="button" size="xs" iconOnly iconName="close" variant="ghost" onClick={() => onOpenChange(false)} />
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("documents.exportModal.format")}</p>
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${Math.max(formatOptions.length, 1)}, minmax(0, 1fr))`,
              }}
            >
              {formatOptions.map((option) => {
                const active = format === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormat(option.value as ExportFormat)}
                    className={
                      active
                        ? "inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/15 px-3 text-xs font-semibold text-primary"
                        : "inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border bg-background/60 px-3 text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                    }
                  >
                    <HugIcon icon={EXPORT_FORMAT_ICON_BY_VALUE[option.value as ExportFormat]} size={14} />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <FormField
            type="select"
            label={t("documents.exportModal.template")}
            value={effectiveTemplateId}
            onChange={setTemplateId}
            options={
              matchingTemplates.length
                ? matchingTemplates.map((item) => ({
                    value: item.id,
                    label: `${item.name}${item.isDefault ? ` (${t("documents.exportModal.defaultTemplate")})` : ""}`,
                  }))
                : [{ value: "", label: canExportWithoutTemplate ? t("documents.exportModal.templateNotRequired") : t("documents.exportModal.noTemplate") }]
            }
          />

          {!matchingTemplates.length ? (
            <p className="text-xs text-muted-foreground">{t(templateHintKey)}</p>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <UiButton type="button" size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </UiButton>
          <UiButton
            type="button"
            size="sm"
            variant="primary"
            disabled={submitting || (!matchingTemplates.length && !canExportWithoutTemplate)}
            onClick={() => void submitExport()}
          >
            {t("documents.exportModal.exportNow")}
          </UiButton>
        </div>
      </div>
    </div>
  );
}
