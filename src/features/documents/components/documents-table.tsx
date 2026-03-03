"use client";

import { AiSearchIcon, Cancel01Icon, Edit02Icon, Exchange01Icon, EyeIcon, FileExportIcon, MailSend02Icon, StatusIcon } from "@hugeicons/core-free-icons";
import { useCallback, useEffect, useMemo, useState } from "react";

import { NewDocumentModal, type DocumentEditorInitialData, type DocumentSavedRow } from "@/components/documents/new-document-modal";
import { ExportDocumentModal } from "@/components/documents/export-document-modal";
import { ActionMenu } from "@/components/ui/action-menu";
import { FilterField } from "@/components/ui/filter-field";
import { FormField } from "@/components/ui/form-field";
import { HugIcon } from "@/components/ui/hug-icon";
import { useMsgBox } from "@/components/ui/msg-box";
import { useToast } from "@/components/ui/toast";
import { UiButton } from "@/components/ui/ui-button";
import {
  convertDocumentAction,
  deleteDocumentAction,
  getDocumentDetailsAction,
  getDocumentForEditAction,
  listDocumentsAction,
  sendDocumentEmailAction,
  updateDocumentStatusAction,
} from "@/features/documents/actions";
import {
  applyEmailTemplateVariables,
  DOCUMENT_TYPE_OPTIONS,
  DocumentViewMode,
  getEmailTemplateSettings,
  getDocumentsViewMode,
  setDocumentsViewMode,
  STORE_EVENTS,
} from "@/features/documents/lib/workspace-store";
import { useI18n } from "@/i18n/provider";

type DocumentRow = {
  id: string;
  number: string;
  type: (typeof DOCUMENT_TYPE_OPTIONS)[number];
  client: string;
  status: string;
  total: string;
  issueDate: string;
};

type DocumentsTableProps = {
  initialRows: DocumentRow[];
};

type DocumentDetails = {
  id: string;
  number: string;
  type: (typeof DOCUMENT_TYPE_OPTIONS)[number];
  status: string;
  title: string;
  issueDate: string;
  dueDate: string | null;
  language: string;
  currency: string;
  tvaRate: number;
  client: {
    id: string | null;
    name: string;
    email: string;
    phone: string;
    address: string;
    ice: string;
    ifNumber: string;
  };
  totals: {
    subtotalHT: number;
    totalTax: number;
    totalTTC: number;
    amountPaid: number;
    amountDue: number;
  };
  notes: string;
  terms: string;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    name: string;
    email: string;
  };
  lines: Array<{
    id: string;
    designation: string;
    unit: string;
    quantity: number;
    unitPriceHT: number;
    vatRate: number;
    lineSubtotalHT: number;
    lineTotalTTC: number;
  }>;
  attachmentsCount: number;
  convertedFrom: {
    id: string;
    number: string;
    type: (typeof DOCUMENT_TYPE_OPTIONS)[number];
  } | null;
  relatedTargets: Array<{
    id: string;
    number: string;
    type: (typeof DOCUMENT_TYPE_OPTIONS)[number];
    relationType: string;
  }>;
  relatedSources: Array<{
    id: string;
    number: string;
    type: (typeof DOCUMENT_TYPE_OPTIONS)[number];
    relationType: string;
  }>;
  statusEvents: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    note: string;
    createdAt: string;
  }>;
};

const DOCUMENT_TYPE_I18N_KEYS: Record<(typeof DOCUMENT_TYPE_OPTIONS)[number], string> = {
  DEVIS: "documents.types.devis",
  FACTURE: "documents.types.facture",
  FACTURE_PROFORMA: "documents.types.factureProforma",
  BON_LIVRAISON: "documents.types.bonLivraison",
  BON_COMMANDE: "documents.types.bonCommande",
  EXTRACT_DEVIS: "documents.types.extractDevis",
  EXTRACT_BON_COMMANDE_PUBLIC: "documents.types.extractBonCommandePublic",
};

const DOCUMENT_STATUS_I18N_KEYS: Record<string, string> = {
  DRAFT: "documents.status.draft",
  ISSUED: "documents.status.issued",
  SENT: "documents.status.sent",
  PAID: "documents.status.paid",
  OVERDUE: "documents.status.overdue",
  CANCELLED: "documents.status.cancelled",
};

function formatMoney(value: number, currency = "MAD") {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(2)} ${currency}`;
}

function statusBadgeClass(status: string) {
  const shared = "rounded-full border px-3 py-0.5 text-[12px] font-semibold";
  const byStatus: Record<string, string> = {
    DRAFT: "border-slate-400/40 bg-slate-400/10 text-slate-300",
    ISSUED: "border-sky-400/40 bg-sky-500/10 text-sky-300",
    SENT: "border-indigo-400/40 bg-indigo-500/10 text-indigo-300",
    PAID: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
    OVERDUE: "border-amber-400/50 bg-amber-500/15 text-amber-300",
    CANCELLED: "border-rose-400/40 bg-rose-500/10 text-rose-300",
  };
  return `${shared} ${byStatus[status] || "border-border text-muted-foreground"}`;
}

export function DocumentsTable({ initialRows }: DocumentsTableProps) {
  const { info, success, error } = useToast();
  const { t } = useI18n();
  const { confirm } = useMsgBox();
  const [allRows, setAllRows] = useState<DocumentRow[]>(initialRows);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [onlyPaid, setOnlyPaid] = useState(false);
  const [viewMode, setViewMode] = useState<DocumentViewMode>("table");
  const [detailsDocumentId, setDetailsDocumentId] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsData, setDetailsData] = useState<DocumentDetails | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editDocument, setEditDocument] = useState<DocumentEditorInitialData | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportDocument, setExportDocument] = useState<DocumentRow | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertSourceDocument, setConvertSourceDocument] = useState<DocumentRow | null>(null);
  const [convertTargetType, setConvertTargetType] = useState<(typeof DOCUMENT_TYPE_OPTIONS)[number] | "">("");

  const refreshDocuments = useCallback(async () => {
    const result = await listDocumentsAction();
    if (!result.ok) {
      error(t("documents.toasts.refreshFailed"));
      return;
    }
    setAllRows(result.rows as DocumentRow[]);
  }, [error, t]);

  useEffect(() => {
    setAllRows(initialRows);
  }, [initialRows]);

  useEffect(() => {
    let active = true;

    const onRefresh = () => {
      if (!active) {
        return;
      }
      void refreshDocuments();
    };

    const timer = window.setTimeout(() => {
      setViewMode(getDocumentsViewMode());
    }, 0);

    window.addEventListener(STORE_EVENTS.documentsUpdated, onRefresh);
    void refreshDocuments();

    return () => {
      active = false;
      window.clearTimeout(timer);
      window.removeEventListener(STORE_EVENTS.documentsUpdated, onRefresh);
    };
  }, [refreshDocuments]);

  const rows = useMemo(() => {
    return allRows.filter((row) => {
      const queryMatch =
        query.trim().length === 0 ||
        row.number.toLowerCase().includes(query.toLowerCase()) ||
        row.client.toLowerCase().includes(query.toLowerCase());

      const typeMatch = type === "all" || row.type === type;
      const statusMatch = status === "all" || row.status === status;

      const overdueMatch = !onlyOverdue || row.status === "OVERDUE";
      const paidMatch = !onlyPaid || row.status === "PAID";

      return queryMatch && typeMatch && statusMatch && overdueMatch && paidMatch;
    });
  }, [allRows, onlyOverdue, onlyPaid, query, status, type]);

  const detailsRow = useMemo(
    () => (detailsDocumentId ? allRows.find((row) => row.id === detailsDocumentId) ?? null : null),
    [allRows, detailsDocumentId],
  );

  const statusLabel = useCallback((value: string) => t(DOCUMENT_STATUS_I18N_KEYS[value] || "documents.status.draft"), [t]);
  const documentTypeLabel = useCallback(
    (value: (typeof DOCUMENT_TYPE_OPTIONS)[number]) => t(DOCUMENT_TYPE_I18N_KEYS[value] || "documents.types.devis"),
    [t],
  );

  const chips = useMemo(() => {
    const output: string[] = [];
    if (query.trim()) output.push(`${t("documents.filters.searchChip")}: ${query}`);
    if (type !== "all") output.push(`${t("documents.filters.typeChip")}: ${documentTypeLabel(type as (typeof DOCUMENT_TYPE_OPTIONS)[number])}`);
    if (status !== "all") output.push(`${t("documents.filters.statusChip")}: ${statusLabel(status)}`);
    if (onlyOverdue) output.push(t("documents.filters.overdueOnly"));
    if (onlyPaid) output.push(t("documents.filters.paidOnly"));
    return output;
  }, [documentTypeLabel, onlyOverdue, onlyPaid, query, status, statusLabel, t, type]);

  const resetFilters = () => {
    setQuery("");
    setType("all");
    setStatus("all");
    setOnlyOverdue(false);
    setOnlyPaid(false);
  };

  const statusOptions = [
    { value: "DRAFT", label: statusLabel("DRAFT") },
    { value: "ISSUED", label: statusLabel("ISSUED") },
    { value: "SENT", label: statusLabel("SENT") },
    { value: "PAID", label: statusLabel("PAID") },
    { value: "OVERDUE", label: statusLabel("OVERDUE") },
    { value: "CANCELLED", label: statusLabel("CANCELLED") },
  ];

  const actionItems = [
    { key: "details", label: t("common.details"), icon: EyeIcon },
    { key: "edit", label: t("common.edit"), icon: Edit02Icon },
    { key: "email", label: t("documents.actions.sendEmail"), icon: MailSend02Icon },
    { key: "export", label: t("common.export"), icon: FileExportIcon },
    { key: "delete", label: t("common.delete"), icon: Cancel01Icon },
  ] as const;

  const applySavedRow = (saved: DocumentSavedRow) => {
    setAllRows((current) => {
      const nextRow: DocumentRow = {
        id: saved.id,
        number: saved.number,
        type: saved.type,
        client: saved.client,
        status: saved.status,
        total: saved.total,
        issueDate: saved.issueDate,
      };
      const index = current.findIndex((row) => row.id === saved.id);
      if (index < 0) {
        return [nextRow, ...current];
      }
      const next = [...current];
      next[index] = nextRow;
      return next;
    });
  };

  const updateRowStatus = async (documentId: string, nextStatus: string) => {
    const result = await updateDocumentStatusAction({
      documentId,
      status: nextStatus as never,
    });
    if (!result.ok) {
      error(t("documents.toasts.statusUpdateFailed"), result.error);
      return;
    }

    setAllRows((current) => current.map((row) => (row.id === documentId ? { ...row, status: result.document.status } : row)));
    setDetailsData((current) => (current && current.id === documentId ? { ...current, status: result.document.status } : current));
    success(t("documents.toasts.statusUpdated"), `${t("documents.labels.newStatus")}: ${statusLabel(result.document.status)}`);
  };

  const deleteRow = async (row: DocumentRow) => {
    const shouldDelete = await confirm({
      title: t("documents.confirm.deleteTitle"),
      description: t("documents.confirm.deleteDescription").replace("{number}", row.number),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
      variant: "danger",
    });

    if (!shouldDelete) {
      return;
    }

    const result = await deleteDocumentAction({ documentId: row.id });
    if (!result.ok) {
      error(t("documents.toasts.deleteFailed"), result.error);
      return;
    }

    setAllRows((current) => current.filter((item) => item.id !== row.id));
    if (detailsDocumentId === row.id) {
      setDetailsDocumentId(null);
      setDetailsData(null);
      setDetailsLoading(false);
    }
    success(t("documents.toasts.deleted"), row.number);
  };

  const openDetailsModal = async (row: DocumentRow) => {
    setDetailsDocumentId(row.id);
    setDetailsLoading(true);
    setDetailsData(null);
    const result = await getDocumentDetailsAction({ documentId: row.id });
    if (!result.ok) {
      setDetailsLoading(false);
      error(t("documents.toasts.detailsFailed"), result.error);
      return;
    }
    setDetailsData(result.document as DocumentDetails);
    setDetailsLoading(false);
  };

  const openEditModal = async (row: DocumentRow) => {
    const result = await getDocumentForEditAction({ documentId: row.id });
    if (!result.ok) {
      error(t("documents.toasts.loadFailed"), result.error);
      return;
    }
    setDetailsDocumentId(null);
    setDetailsData(null);
    setDetailsLoading(false);
    setEditDocument(result.document as DocumentEditorInitialData);
    setEditOpen(true);
  };

  const sendEmailForDocument = async (row: DocumentRow) => {
    const detailsResult = await getDocumentDetailsAction({ documentId: row.id });
    if (!detailsResult.ok) {
      error(t("documents.toasts.emailLoadFailed"), detailsResult.error);
      return;
    }

    const details = detailsResult.document as DocumentDetails;
    const recipient = (details.client.email || "").trim();
    if (!recipient) {
      error(t("documents.toasts.clientEmailMissing"), t("documents.toasts.clientEmailMissingHint"));
      return;
    }

    const template = getEmailTemplateSettings()[row.type];
    if (!template.enabled) {
      info(t("documents.toasts.emailTemplateDisabled"));
      return;
    }

    const variables = {
      client_name: details.client.name || row.client,
      document_number: details.number,
      document_type: documentTypeLabel(row.type),
      total_ttc: formatMoney(details.totals.totalTTC, details.currency),
    };
    const subject = applyEmailTemplateVariables(template.subject, variables);
    const body = applyEmailTemplateVariables(template.body, variables);

    const emailResult = await sendDocumentEmailAction({
      documentId: row.id,
      recipient,
      subject,
      body,
    });
    if (!emailResult.ok) {
      error(t("documents.toasts.emailLoadFailed"), emailResult.error);
      return;
    }

    setAllRows((current) =>
      current.map((item) => (item.id === row.id ? { ...item, status: emailResult.document.status } : item)),
    );
    setDetailsData((current) =>
      current && current.id === row.id ? { ...current, status: emailResult.document.status } : current,
    );
    success(t("documents.toasts.emailPrepared"), `${recipient} - ${subject}`);
  };

  const runRowAction = async (action: "edit" | "details" | "convert" | "email" | "export" | "delete", row: DocumentRow) => {
    if (action === "edit") {
      await openEditModal(row);
      return;
    }
    if (action === "details") {
      await openDetailsModal(row);
      return;
    }
    if (action === "email") {
      await sendEmailForDocument(row);
      return;
    }
    if (action === "delete") {
      await deleteRow(row);
      return;
    }
    if (action === "convert") {
      const targets = DOCUMENT_TYPE_OPTIONS.filter((value) => value !== row.type);
      if (!targets.length) {
        info(t("documents.convertModal.noTarget"));
        return;
      }
      setConvertSourceDocument(row);
      setConvertTargetType(targets[0]);
      setConvertOpen(true);
      return;
    }
    setExportDocument(row);
    setExportOpen(true);
  };

  const convertTargetOptions = useMemo(() => {
    if (!convertSourceDocument) {
      return [];
    }
    return DOCUMENT_TYPE_OPTIONS.filter((value) => value !== convertSourceDocument.type).map((targetType) => ({
      value: targetType,
      label: documentTypeLabel(targetType),
    }));
  }, [convertSourceDocument, documentTypeLabel]);

  const submitConversion = async () => {
    if (!convertSourceDocument) {
      return;
    }
    if (!convertTargetType) {
      error(t("documents.toasts.convertFailed"), t("documents.convertModal.noTarget"));
      return;
    }
    const result = await convertDocumentAction({
      documentId: convertSourceDocument.id,
      targetType: convertTargetType as never,
    });
    if (!result.ok) {
      error(t("documents.toasts.convertFailed"), result.error);
      return;
    }
    setConvertOpen(false);
    setConvertSourceDocument(null);
    setConvertTargetType("");
    void refreshDocuments();
    success(t("documents.toasts.converted"), `${result.source.number} -> ${result.document.number}`);
  };

  const renderActionsMenu = (row: DocumentRow) => {
    return (
      <ActionMenu
        triggerAriaLabel={t("documents.actions.openActions")}
        sections={[
          {
            id: "actions",
            items: actionItems.map((item) => ({
              id: item.key,
              label: item.label,
              icon: item.icon,
              onSelect: () => void runRowAction(item.key, row),
            })),
          },
          {
            id: "status",
            label: t("documents.labels.status"),
            icon: StatusIcon,
            items: statusOptions.map((option) => ({
              id: option.value,
              label: option.label,
              active: row.status === option.value,
              onSelect: () => void updateRowStatus(row.id, option.value),
            })),
          },
        ]}
      />
    );
  };

  const renderConvertAction = (row: DocumentRow) => {
    return (
      <UiButton
        type="button"
        size="xs"
        variant="outline"
        iconOnly
        icon={Exchange01Icon}
        aria-label={t("documents.actions.convert")}
        title={t("documents.actions.convert")}
        onClick={() => void runRowAction("convert", row)}
      />
    );
  };

  const closeDetailsModal = () => {
    setDetailsDocumentId(null);
    setDetailsData(null);
    setDetailsLoading(false);
  };

  const detailsActionRow: DocumentRow | null =
    detailsRow ||
    (detailsData
      ? {
          id: detailsData.id,
          number: detailsData.number,
          type: detailsData.type,
          client: detailsData.client.name || t("documents.clientFallback"),
          status: detailsData.status,
          total: formatMoney(detailsData.totals.totalTTC, detailsData.currency),
          issueDate: detailsData.issueDate,
        }
      : null);

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-md border border-border p-4">
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:grid-cols-[3fr_1fr_1fr_1fr_auto]">
          <FilterField
            value={query}
            placeholder={t("documents.filters.searchPlaceholder")}
            icon={<HugIcon icon={AiSearchIcon} size={14} />}
            onChange={setQuery}
          />
          <FilterField
            value={type}
            onChange={setType}
            options={[
              { value: "all", label: t("documents.filters.allTypes") },
              ...DOCUMENT_TYPE_OPTIONS.map((documentType) => ({
                value: documentType,
                label: documentTypeLabel(documentType),
              })),
            ]}
          />
          <FilterField
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: t("documents.filters.allStatuses") },
              { value: "DRAFT", label: statusLabel("DRAFT") },
              { value: "ISSUED", label: statusLabel("ISSUED") },
              { value: "SENT", label: statusLabel("SENT") },
              { value: "PAID", label: statusLabel("PAID") },
              { value: "OVERDUE", label: statusLabel("OVERDUE") },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            <FormField type="checkbox" label={t("documents.filters.overdueOnly")} checked={onlyOverdue} onCheckedChange={setOnlyOverdue} className="font-light" />
            <FormField type="checkbox" label={t("documents.filters.paidOnly")} checked={onlyPaid} onCheckedChange={setOnlyPaid} className="font-light" />
          </div>
          <div className="flex items-center gap-2">
            <UiButton
              type="button"
              size="xs"
              iconOnly
              iconName="table"
              aria-label={t("common.tableView")}
              title={t("common.tableView")}
              variant={viewMode === "table" ? "primary" : "ghost"}
              onClick={() => {
                setViewMode("table");
                setDocumentsViewMode("table");
              }}
            />
            <UiButton
              type="button"
              size="xs"
              iconOnly
              iconName="grid"
              aria-label={t("common.gridView")}
              title={t("common.gridView")}
              variant={viewMode === "grid" ? "primary" : "ghost"}
              onClick={() => {
                setViewMode("grid");
                setDocumentsViewMode("grid");
              }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {chips.map((chip) => (
            <span key={chip} className="rounded-md border border-border bg-background/60 px-3 py-1.5">
              {chip}
            </span>
          ))}
          {chips.length ? (
            <UiButton size="xs" variant="primary" iconOnly aria-label={t("common.resetFilters")} onClick={resetFilters}>
              ×
            </UiButton>
          ) : null}
        </div>
      </div>

      {viewMode === "table" ? (
        <div className="overflow-x-auto rounded-md border border-border bg-card/70">
          <table className="w-full text-sm">
            <thead className="bg-background/70 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start">{t("documents.table.number")}</th>
                <th className="px-4 py-3 text-start">{t("documents.table.type")}</th>
                <th className="px-4 py-3 text-start">{t("documents.table.client")}</th>
                <th className="px-4 py-3 text-start">{t("documents.table.status")}</th>
                <th className="px-4 py-3 text-start">{t("documents.table.total")}</th>
                <th className="px-4 py-3 text-start">{t("documents.table.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card/50">
              {rows.length ? (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-semibold text-foreground">{row.number}</td>
                    <td className="px-4 py-3 text-muted-foreground">{documentTypeLabel(row.type)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.client}</td>
                    <td className="px-4 py-3">
                      <span className={statusBadgeClass(row.status)}>{statusLabel(row.status)}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.total}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {renderConvertAction(row)}
                        {renderActionsMenu(row)}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-xs text-muted-foreground">
                    {t("documents.table.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.length ? (
            rows.map((row) => (
              <article key={row.id} className="space-y-3 rounded-md border border-border bg-card/70 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{documentTypeLabel(row.type)}</p>
                    <h3 className="text-sm font-semibold text-foreground">{row.number}</h3>
                  </div>
                  <div className="flex gap-2">
                    <span className={statusBadgeClass(row.status)}>{statusLabel(row.status)}</span>
                    <div className="flex justify-end gap-2">
                      {renderConvertAction(row)}
                      {renderActionsMenu(row)}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{row.client}</p>
                <div className="flex items-end justify-between">
                  <p className="text-xs text-muted-foreground">{row.issueDate.slice(0, 10)}</p>
                  <p className="text-sm font-semibold text-foreground">{row.total}</p>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-md border border-border bg-card/70 p-6 text-center text-xs text-muted-foreground md:col-span-2 xl:col-span-3">
              {t("documents.table.empty")}
            </div>
          )}
        </div>
      )}

      {detailsDocumentId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-md border border-border bg-card/95 p-4 shadow-2xl shadow-black/50">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                  {detailsData ? documentTypeLabel(detailsData.type) : detailsRow ? documentTypeLabel(detailsRow.type) : t("documents.labels.document")}
                </p>
                <h3 className="text-lg font-semibold text-foreground">{detailsData?.number || detailsRow?.number || t("documents.details.title")}</h3>
              </div>
              <UiButton type="button" size="xs" variant="ghost" iconOnly iconName="close" onClick={closeDetailsModal} />
            </div>

            {detailsLoading ? (
              <div className="rounded-md border border-border bg-background/30 p-8 text-center text-sm text-muted-foreground">{t("documents.details.loading")}</div>
            ) : detailsData ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <DetailCard label={t("documents.details.number")} value={detailsData.number} />
                  <DetailCard label={t("documents.details.status")} value={statusLabel(detailsData.status)} />
                  <DetailCard label={t("documents.details.issueDate")} value={detailsData.issueDate.slice(0, 10)} />
                  <DetailCard label={t("documents.details.dueDate")} value={detailsData.dueDate ? detailsData.dueDate.slice(0, 10) : "-"} />
                  <DetailCard label={t("documents.details.language")} value={detailsData.language} />
                  <DetailCard label={t("documents.details.currency")} value={detailsData.currency} />
                  <DetailCard label={t("documents.details.createdBy")} value={detailsData.createdBy.name} />
                  <DetailCard label={t("documents.details.attachments")} value={String(detailsData.attachmentsCount)} />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <section className="rounded-md border border-border bg-background/30 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("documents.details.clientSection")}</p>
                    <div className="mt-2 grid gap-2 text-xs">
                      <p className="font-semibold text-foreground">{detailsData.client.name || "-"}</p>
                      <p className="text-muted-foreground">{detailsData.client.email || "-"}</p>
                      <p className="text-muted-foreground">{detailsData.client.phone || "-"}</p>
                      <p className="text-muted-foreground">{detailsData.client.address || "-"}</p>
                      <p className="text-muted-foreground">{t("documents.details.iceIf")}: {detailsData.client.ice || "-"} / {detailsData.client.ifNumber || "-"}</p>
                    </div>
                  </section>

                  <section className="rounded-md border border-border bg-background/30 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("documents.details.financialSummary")}</p>
                    <div className="mt-2 grid gap-1 text-xs">
                      <p className="flex items-center justify-between text-muted-foreground">
                        <span>{t("documents.details.subtotalHT")}</span>
                        <span className="font-semibold text-foreground">{formatMoney(detailsData.totals.subtotalHT, detailsData.currency)}</span>
                      </p>
                      <p className="flex items-center justify-between text-muted-foreground">
                        <span>{t("documents.details.taxTotal")}</span>
                        <span className="font-semibold text-foreground">{formatMoney(detailsData.totals.totalTax, detailsData.currency)}</span>
                      </p>
                      <p className="flex items-center justify-between text-muted-foreground">
                        <span>{t("documents.details.totalTTC")}</span>
                        <span className="font-semibold text-foreground">{formatMoney(detailsData.totals.totalTTC, detailsData.currency)}</span>
                      </p>
                      <p className="flex items-center justify-between text-muted-foreground">
                        <span>{t("documents.details.amountPaid")}</span>
                        <span className="font-semibold text-foreground">{formatMoney(detailsData.totals.amountPaid, detailsData.currency)}</span>
                      </p>
                      <p className="flex items-center justify-between text-muted-foreground">
                        <span>{t("documents.details.amountDue")}</span>
                        <span className="font-semibold text-foreground">{formatMoney(detailsData.totals.amountDue, detailsData.currency)}</span>
                      </p>
                      <p className="flex items-center justify-between text-muted-foreground">
                        <span>{t("documents.details.defaultTva")}</span>
                        <span className="font-semibold text-foreground">{detailsData.tvaRate.toFixed(2)}%</span>
                      </p>
                    </div>
                  </section>
                </div>

                <section className="rounded-md border border-border bg-background/30 p-3">
                  <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("documents.details.lineItems")}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-xs">
                      <thead className="text-muted-foreground">
                        <tr>
                          <th className="px-2 py-2 text-start">{t("documents.details.designation")}</th>
                          <th className="px-2 py-2 text-start">{t("documents.details.unit")}</th>
                          <th className="px-2 py-2 text-end">{t("documents.details.qty")}</th>
                          <th className="px-2 py-2 text-end">{t("documents.details.unitPriceHT")}</th>
                          <th className="px-2 py-2 text-end">{t("documents.details.tva")}</th>
                          <th className="px-2 py-2 text-end">{t("documents.details.totalHT")}</th>
                          <th className="px-2 py-2 text-end">{t("documents.details.totalTtcShort")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {detailsData.lines.length ? (
                          detailsData.lines.map((line) => (
                            <tr key={line.id}>
                              <td className="px-2 py-2 text-foreground">{line.designation}</td>
                              <td className="px-2 py-2 text-muted-foreground">{line.unit}</td>
                              <td className="px-2 py-2 text-end text-muted-foreground">{line.quantity.toFixed(3)}</td>
                              <td className="px-2 py-2 text-end text-muted-foreground">{formatMoney(line.unitPriceHT, detailsData.currency)}</td>
                              <td className="px-2 py-2 text-end text-muted-foreground">{line.vatRate.toFixed(2)}%</td>
                              <td className="px-2 py-2 text-end text-muted-foreground">{formatMoney(line.lineSubtotalHT, detailsData.currency)}</td>
                              <td className="px-2 py-2 text-end font-semibold text-foreground">{formatMoney(line.lineTotalTTC, detailsData.currency)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="px-2 py-4 text-center text-muted-foreground">
                              {t("documents.details.noLineItems")}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <div className="grid gap-3 md:grid-cols-2">
                  <section className="rounded-md border border-border bg-background/30 p-3">
                    <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("documents.details.relations")}</p>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {detailsData.convertedFrom ? (
                        <p>
                          {t("documents.details.from")}: {detailsData.convertedFrom.number} ({documentTypeLabel(detailsData.convertedFrom.type)})
                        </p>
                      ) : (
                        <p>{t("documents.details.from")}: -</p>
                      )}
                      {detailsData.relatedSources.map((item) => (
                        <p key={`src-${item.id}`}>
                          {t("documents.details.source")}: {item.number} ({item.relationType})
                        </p>
                      ))}
                      {detailsData.relatedTargets.map((item) => (
                        <p key={`target-${item.id}`}>
                          {t("documents.details.target")}: {item.number} ({item.relationType})
                        </p>
                      ))}
                      {!detailsData.relatedSources.length && !detailsData.relatedTargets.length ? <p>{t("documents.details.noLinkedDocuments")}</p> : null}
                    </div>
                  </section>

                  <section className="rounded-md border border-border bg-background/30 p-3">
                    <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("documents.details.statusHistory")}</p>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {detailsData.statusEvents.length ? (
                        detailsData.statusEvents.map((event) => (
                          <p key={event.id}>
                            {event.createdAt.slice(0, 10)}: {event.fromStatus ? statusLabel(event.fromStatus) : t("documents.details.start")} {t("documents.details.to")}{" "}
                            {statusLabel(event.toStatus)}
                            {event.note ? ` (${event.note})` : ""}
                          </p>
                        ))
                      ) : (
                        <p>{t("documents.details.noStatusEvents")}</p>
                      )}
                    </div>
                  </section>
                </div>

                {detailsData.notes || detailsData.terms ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <section className="rounded-md border border-border bg-background/30 p-3">
                      <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("documents.details.notes")}</p>
                      <p className="whitespace-pre-wrap text-xs text-muted-foreground">{detailsData.notes || "-"}</p>
                    </section>
                    <section className="rounded-md border border-border bg-background/30 p-3">
                      <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("documents.details.terms")}</p>
                      <p className="whitespace-pre-wrap text-xs text-muted-foreground">{detailsData.terms || "-"}</p>
                    </section>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-md border border-border bg-background/30 p-8 text-center text-sm text-muted-foreground">
                {t("documents.details.failed")}
              </div>
            )}

            {detailsActionRow ? (
              <>
                <div className="mt-4 rounded-md border border-border bg-background/30 p-3">
                  <FormField
                    type="select"
                    label={t("documents.details.changeStatus")}
                    value={detailsData?.status || detailsActionRow.status}
                    options={statusOptions}
                    onChange={(value) => void updateRowStatus(detailsActionRow.id, value)}
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <UiButton type="button" size="sm" variant="outline" icon={Edit02Icon} label={t("common.edit")} onClick={() => void runRowAction("edit", detailsActionRow)} />
                  <UiButton type="button" size="sm" variant="outline" icon={Exchange01Icon} label={t("documents.actions.convert")} onClick={() => void runRowAction("convert", detailsActionRow)} />
                  <UiButton type="button" size="sm" variant="outline" icon={MailSend02Icon} label={t("documents.actions.sendEmail")} onClick={() => void runRowAction("email", detailsActionRow)} />
                  <UiButton type="button" size="sm" variant="outline" icon={FileExportIcon} label={t("common.export")} onClick={() => void runRowAction("export", detailsActionRow)} />
                  <UiButton type="button" size="sm" variant="danger" icon={Cancel01Icon} label={t("common.delete")} onClick={() => void runRowAction("delete", detailsActionRow)} />
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <NewDocumentModal
        hideTrigger
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setEditDocument(null);
          }
        }}
        initialDocument={editDocument}
        onDocumentSaved={(saved) => {
          applySavedRow(saved);
          void refreshDocuments();
          info(t("documents.toasts.updated"), saved.number);
        }}
      />

      <ExportDocumentModal
        open={exportOpen}
        onOpenChange={(open) => {
          setExportOpen(open);
          if (!open) {
            setExportDocument(null);
          }
        }}
        document={
          exportDocument
            ? {
                id: exportDocument.id,
                number: exportDocument.number,
                type: exportDocument.type,
              }
            : null
        }
      />

      {convertOpen && convertSourceDocument ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-md border border-border bg-card/95 p-4 shadow-2xl shadow-black/50">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("documents.convertModal.tag")}</p>
                <h3 className="text-base font-semibold text-foreground">{t("documents.convertModal.title")}</h3>
                <p className="text-xs text-muted-foreground">
                  {convertSourceDocument.number} - {documentTypeLabel(convertSourceDocument.type)}
                </p>
              </div>
              <UiButton
                type="button"
                size="xs"
                iconOnly
                iconName="close"
                variant="ghost"
                onClick={() => {
                  setConvertOpen(false);
                  setConvertSourceDocument(null);
                  setConvertTargetType("");
                }}
              />
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("documents.convertModal.targetType")}</p>
                <div
                  className="grid gap-2"
                  style={{
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  }}
                >
                  {convertTargetOptions.map((option) => {
                    const active = convertTargetType === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setConvertTargetType(option.value as (typeof DOCUMENT_TYPE_OPTIONS)[number])}
                        className={
                          active
                            ? "inline-flex h-9 w-full items-center justify-center rounded-md border border-primary/40 bg-primary/15 px-3 text-xs font-semibold text-primary"
                            : "inline-flex h-9 w-full items-center justify-center rounded-md border border-border bg-background/60 px-3 text-xs font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                        }
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {!convertTargetOptions.length ? (
                <p className="text-xs text-muted-foreground">{t("documents.convertModal.noTarget")}</p>
              ) : null}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <UiButton
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setConvertOpen(false);
                  setConvertSourceDocument(null);
                  setConvertTargetType("");
                }}
              >
                {t("common.cancel")}
              </UiButton>
              <UiButton
                type="button"
                size="sm"
                variant="primary"
                disabled={!convertTargetOptions.length || !convertTargetType}
                onClick={() => void submitConversion()}
              >
                {t("documents.convertModal.convertNow")}
              </UiButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-3 text-xs">
      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value || "-"}</p>
    </div>
  );
}
