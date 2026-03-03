"use client";

import { useRef, useState } from "react";

import { useToast } from "@/components/ui/toast";
import { UiButton } from "@/components/ui/ui-button";
import { queueExcelImportAction } from "@/features/documents/actions";
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
      error(t("documents.page.importExcelFailed"), result.error);
      return;
    }

    success(t("documents.page.importExcelQueued"), `${result.job.fileName} #${result.job.id.slice(-8)}`);
    info(t("documents.page.importExcelHint"));
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
