"use client";

import * as XLSX from "xlsx";

import { UiButton } from "@/components/ui/ui-button";

type DocumentExportRow = {
  number: string;
  type: string;
  client: string;
  status: string;
  total: string;
  issueDate: string;
};

type ExportDocumentsListButtonProps = {
  rows: DocumentExportRow[];
  label: string;
};

export function ExportDocumentsListButton({ rows, label }: ExportDocumentsListButtonProps) {
  const exportRows = () => {
    const worksheetData = rows.map((row) => ({
      Number: row.number,
      Type: row.type,
      Client: row.client,
      Status: row.status,
      "Total TTC": row.total,
      "Issue Date": row.issueDate.slice(0, 10),
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    worksheet["!cols"] = [
      { wch: 18 },
      { wch: 18 },
      { wch: 28 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Documents");
    const dateStamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `documents-list-${dateStamp}.xlsx`, { compression: true });
  };

  return (
    <UiButton
      type="button"
      size="sm"
      variant="subtle"
      iconName="export"
      label={label}
      disabled={!rows.length}
      onClick={exportRows}
    />
  );
}
