"use client";

import { useRef, useState } from "react";

import { useToast } from "@/components/ui/toast";
import { UiButton } from "@/components/ui/ui-button";
import { queueExcelImportAction } from "@/features/documents/actions";
import { emitWorkspaceEvent, requestDocumentEditorOpen, STORE_EVENTS } from "@/features/documents/lib/workspace-store";
import { useI18n } from "@/i18n/provider";

export function ExtractImportPanel() {
  const { info, success, error } = useToast();
  const { t } = useI18n();
  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const openPicker = () => {
    excelInputRef.current?.click();
  };

  const onFilePicked = async (file: File | null) => {
    if (!file) {
      return;
    }

    const body = new FormData();
    body.set("file", file);
    setSubmitting(true);
    const result = await queueExcelImportAction(body);
    setSubmitting(false);

    if (!result.ok) {
      const errorCode = "errorCode" in result ? result.errorCode : undefined;
      const errorKeyByCode: Record<string, string> = {
        FILE_REQUIRED: "documents.page.importExcelErrors.fileRequired",
        FILE_EMPTY: "documents.page.importExcelErrors.fileEmpty",
        FILE_TOO_LARGE: "documents.page.importExcelErrors.fileTooLarge",
        INVALID_EXTENSION: "documents.page.importExcelErrors.invalidExtension",
        NO_ARTICLE_LINES: "documents.page.importExcelErrors.noLinesDetected",
        PARSE_FAILED: "documents.page.importExcelErrors.parseFailed",
      };
      const localized = errorCode ? t(errorKeyByCode[errorCode] || "documents.page.importExcelFailed") : result.error;
      error(t("documents.page.importExcelFailed"), localized);
      return;
    }

    success(
      t("documents.page.importExcelDraftCreated"),
      `${result.document.number} - ${result.document.client}`,
    );
    info(t("documents.page.importExcelDraftHint").replace("{count}", String(result.preview.lineCount)));
    emitWorkspaceEvent(STORE_EVENTS.documentsUpdated);
    requestDocumentEditorOpen(result.document.id);
  };

  return (
    <>
      <UiButton
        type="button"
        size="sm"
        variant="outline"
        iconName="import"
        label={submitting ? t("documents.page.importingExcel") : t("documents.page.importExcelAllProjects")}
        disabled={submitting}
        onClick={openPicker}
      />
      <input
        ref={excelInputRef}
        type="file"
        className="hidden"
        accept=".xls,.xlsx"
        onChange={async (event) => {
          const input = event.currentTarget;
          const file = input.files?.[0] ?? null;
          await onFilePicked(file);
          input.value = "";
        }}
      />
    </>
  );
}
