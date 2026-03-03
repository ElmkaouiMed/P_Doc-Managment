"use client";

import { AiSearchIcon, Cancel01Icon, Edit02Icon, EyeIcon, UserSquareIcon } from "@hugeicons/core-free-icons";
import { useEffect, useMemo, useState } from "react";

import { ActionMenu } from "@/components/ui/action-menu";
import { FilterField } from "@/components/ui/filter-field";
import { FormField } from "@/components/ui/form-field";
import { HugIcon } from "@/components/ui/hug-icon";
import { useMsgBox } from "@/components/ui/msg-box";
import { useToast } from "@/components/ui/toast";
import { UiButton } from "@/components/ui/ui-button";
import { deleteClientAction, updateClientAction } from "@/features/clients/actions";
import { useI18n } from "@/i18n/provider";

type ClientViewMode = "table" | "grid";

type ClientRow = {
  id: string;
  code: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  phoneFix: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  ice: string | null;
  ifNumber: string | null;
  notes: string | null;
  documentsCount: number;
  totalBilled: number;
  totalDue: number;
  totalPaid: number;
  overdueDocuments: number;
  lastDocumentAt: string | null;
  updatedAt: string;
};

type ClientsViewProps = {
  clients: ClientRow[];
};

const VIEW_KEY = "clients-view-mode";

export function ClientsView({ clients }: ClientsViewProps) {
  const { success, error } = useToast();
  const { t } = useI18n();
  const { confirm } = useMsgBox();
  const [rows, setRows] = useState<ClientRow[]>(clients);
  const [query, setQuery] = useState("");
  const [relationFilter, setRelationFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ClientViewMode>("table");
  const [detailsClientId, setDetailsClientId] = useState<string | null>(null);
  const [editClientId, setEditClientId] = useState<string | null>(null);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [editValues, setEditValues] = useState({
    code: "",
    name: "",
    email: "",
    phone: "",
    phoneFix: "",
    address: "",
    city: "",
    country: "",
    ice: "",
    ifNumber: "",
    notes: "",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem(VIEW_KEY);
      if (stored === "grid") {
        setViewMode("grid");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    setRows(clients);
  }, [clients]);

  const setMode = (mode: ClientViewMode) => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(VIEW_KEY, mode);
    }
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((client) => {
      const matchesQuery =
        needle.length === 0 ||
        client.name.toLowerCase().includes(needle) ||
        (client.email || "").toLowerCase().includes(needle) ||
        (client.phone || "").toLowerCase().includes(needle) ||
        (client.address || "").toLowerCase().includes(needle);

      const matchesRelation =
        relationFilter === "all" ||
        (relationFilter === "with_docs" && client.documentsCount > 0) ||
        (relationFilter === "without_docs" && client.documentsCount === 0) ||
        (relationFilter === "overdue" && client.overdueDocuments > 0);

      return matchesQuery && matchesRelation;
    });
  }, [query, relationFilter, rows]);

  const stats = useMemo(() => {
    const totalDocuments = rows.reduce((sum, client) => sum + client.documentsCount, 0);
    const totalDue = rows.reduce((sum, client) => sum + client.totalDue, 0);
    const totalPaid = rows.reduce((sum, client) => sum + client.totalPaid, 0);
    const overdueClients = rows.filter((client) => client.overdueDocuments > 0).length;
    return {
      total: rows.length,
      totalDocuments,
      totalDue,
      totalPaid,
      overdueClients,
    };
  }, [rows]);

  const detailsClient = useMemo(() => (detailsClientId ? rows.find((row) => row.id === detailsClientId) ?? null : null), [detailsClientId, rows]);

  const openEditClient = (client: ClientRow) => {
    setDetailsClientId(null);
    setEditClientId(client.id);
    setEditValues({
      code: client.code || "",
      name: client.name || "",
      email: client.email || "",
      phone: client.phone || "",
      phoneFix: client.phoneFix || "",
      address: client.address || "",
      city: client.city || "",
      country: client.country || "",
      ice: client.ice || "",
      ifNumber: client.ifNumber || "",
      notes: client.notes || "",
    });
  };

  const saveEditedClient = async () => {
    if (!editClientId) {
      return;
    }
    if (!editValues.name.trim()) {
      error(t("clients.toasts.nameRequired"));
      return;
    }
    setIsEditSaving(true);
    const result = await updateClientAction({
      clientId: editClientId,
      code: editValues.code,
      name: editValues.name,
      email: editValues.email,
      phone: editValues.phone,
      phoneFix: editValues.phoneFix,
      address: editValues.address,
      city: editValues.city,
      country: editValues.country,
      ice: editValues.ice,
      ifNumber: editValues.ifNumber,
      notes: editValues.notes,
    });
    setIsEditSaving(false);

    if (!result.ok) {
      error(t("clients.toasts.updateFailed"), result.error);
      return;
    }

    setRows((current) =>
      current.map((item) =>
        item.id === editClientId
          ? {
              ...item,
              ...result.client,
            }
          : item,
      ),
    );
    success(t("clients.toasts.updated"), result.client.name);
    setEditClientId(null);
  };

  const runClientAction = async (action: "details" | "edit" | "delete", client: ClientRow) => {
    if (action === "details") {
      setDetailsClientId(client.id);
      return;
    }
    if (action === "edit") {
      openEditClient(client);
      return;
    }

    const shouldDelete = await confirm({
      title: t("clients.confirm.deleteTitle"),
      description: t("clients.confirm.deleteDescription").replace("{name}", client.name),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
      variant: "danger",
    });

    if (!shouldDelete) {
      return;
    }

    const result = await deleteClientAction({ clientId: client.id });
    if (!result.ok) {
      error(t("clients.toasts.deleteFailed"), result.error);
      return;
    }

    setRows((current) => current.filter((row) => row.id !== client.id));
    if (detailsClientId === client.id) {
      setDetailsClientId(null);
    }
    if (editClientId === client.id) {
      setEditClientId(null);
    }
    success(t("clients.toasts.deleted"), client.name);
  };

  const renderActions = (client: ClientRow) => (
    <ActionMenu
      triggerAriaLabel={t("clients.actions.openActions")}
      sections={[
        {
          id: "actions",
          items: [
            { id: "details", label: t("common.details"), icon: EyeIcon, onSelect: () => void runClientAction("details", client) },
            { id: "edit", label: t("common.edit"), icon: Edit02Icon, onSelect: () => void runClientAction("edit", client) },
            { id: "delete", label: t("common.delete"), icon: Cancel01Icon, onSelect: () => void runClientAction("delete", client) },
          ],
        },
      ]}
    />
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label={t("clients.summary.totalClients")} value={String(stats.total)} />
        <SummaryCard label={t("clients.summary.relatedDocuments")} value={String(stats.totalDocuments)} />
        <SummaryCard label={t("clients.summary.outstandingDue")} value={`${stats.totalDue.toFixed(2)} MAD`} />
        <SummaryCard label={t("clients.summary.totalPaid")} value={`${stats.totalPaid.toFixed(2)} MAD`} />
        <SummaryCard label={t("clients.summary.overdueClients")} value={String(stats.overdueClients)} />
      </div>

      <div className="space-y-3 rounded-md border border-border bg-card/70 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <FilterField
            value={query}
            placeholder={t("clients.filters.searchPlaceholder")}
            icon={<HugIcon icon={AiSearchIcon} size={14} />}
            onChange={setQuery}
          />
          <FilterField
            value={relationFilter}
            onChange={setRelationFilter}
            options={[
              { value: "all", label: t("clients.filters.allClients") },
              { value: "with_docs", label: t("clients.filters.withDocuments") },
              { value: "without_docs", label: t("clients.filters.withoutDocuments") },
              { value: "overdue", label: t("clients.filters.hasOverdue") },
            ]}
          />
          <div className="flex items-center gap-2">
            <UiButton
              type="button"
              size="xs"
              iconOnly
              iconName="table"
              aria-label={t("common.tableView")}
              title={t("common.tableView")}
              variant={viewMode === "table" ? "primary" : "ghost"}
              onClick={() => setMode("table")}
            />
            <UiButton
              type="button"
              size="xs"
              iconOnly
              iconName="grid"
              aria-label={t("common.gridView")}
              title={t("common.gridView")}
              variant={viewMode === "grid" ? "primary" : "ghost"}
              onClick={() => setMode("grid")}
            />
          </div>
        </div>
      </div>

      {viewMode === "table" ? (
        <div className="overflow-x-auto rounded-md border border-border bg-card/70">
          <table className="w-full text-sm">
            <thead className="bg-background/70 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start">{t("clients.table.name")}</th>
                <th className="px-4 py-3 text-start">{t("clients.table.email")}</th>
                <th className="px-4 py-3 text-start">{t("clients.table.phone")}</th>
                <th className="px-4 py-3 text-start">{t("clients.table.documents")}</th>
                <th className="px-4 py-3 text-start">{t("clients.table.billed")}</th>
                <th className="px-4 py-3 text-start">{t("clients.table.due")}</th>
                <th className="px-4 py-3 text-start">{t("clients.table.lastDoc")}</th>
                <th className="px-4 py-3 text-start">{t("clients.table.updated")}</th>
                <th className="px-4 py-3 text-start">{t("clients.table.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card/50 text-xs text-muted-foreground">
              {filtered.length ? (
                filtered.map((client) => (
                  <tr key={client.id}>
                    <td className="px-4 py-3 text-foreground">{client.name}</td>
                    <td className="px-4 py-3">{client.email || "-"}</td>
                    <td className="px-4 py-3">{client.phone || "-"}</td>
                    <td className="px-4 py-3">{client.documentsCount}</td>
                    <td className="px-4 py-3">{client.totalBilled.toFixed(2)} MAD</td>
                    <td className="px-4 py-3">{client.totalDue.toFixed(2)} MAD</td>
                    <td className="px-4 py-3">{client.lastDocumentAt ? client.lastDocumentAt.slice(0, 10) : "-"}</td>
                    <td className="px-4 py-3">{client.updatedAt.slice(0, 10)}</td>
                    <td className="px-4 py-3">{renderActions(client)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-xs text-muted-foreground">
                    {t("clients.table.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.length ? (
            filtered.map((client) => (
              <article key={client.id} className="space-y-3 rounded-md border border-border bg-card/70 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{client.name}</p>
                    <p className="text-xs text-muted-foreground">{client.email || t("clients.card.noEmail")}</p>
                  </div>
                  {renderActions(client)}
                </div>
                <p className="text-xs text-muted-foreground">{client.phone || t("clients.card.noPhone")}</p>
                <p className="text-xs text-muted-foreground">{client.address || t("clients.card.noAddress")}</p>
                <div className="grid gap-1 rounded-md border border-border bg-background/30 p-2 text-[11px] text-muted-foreground">
                  <p className="flex items-center justify-between">
                    <span>{t("clients.table.documents")}</span>
                    <span className="font-semibold text-foreground">{client.documentsCount}</span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span>{t("clients.table.billed")}</span>
                    <span className="font-semibold text-foreground">{client.totalBilled.toFixed(2)} MAD</span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span>{t("clients.table.due")}</span>
                    <span className="font-semibold text-foreground">{client.totalDue.toFixed(2)} MAD</span>
                  </p>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    {client.code || "-"} - {client.ice || "-"} / {client.ifNumber || "-"}
                  </span>
                  <span>{client.lastDocumentAt ? client.lastDocumentAt.slice(0, 10) : client.updatedAt.slice(0, 10)}</span>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-md border border-border bg-card/70 p-6 text-center text-xs text-muted-foreground md:col-span-2 xl:col-span-3">
              {t("clients.table.empty")}
            </div>
          )}
        </div>
      )}

      {detailsClient ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-md border border-border bg-card/95 p-4 shadow-2xl shadow-black/50">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">{t("clients.details.title")}</p>
                <h3 className="text-lg font-semibold text-foreground">{detailsClient.name}</h3>
              </div>
              <UiButton type="button" size="xs" variant="ghost" iconOnly iconName="close" onClick={() => setDetailsClientId(null)} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <InfoCard label={t("clients.table.email")} value={detailsClient.email || "-"} />
              <InfoCard label={t("clients.table.phone")} value={detailsClient.phone || "-"} />
              <InfoCard label={t("clients.form.phoneFix")} value={detailsClient.phoneFix || "-"} />
              <InfoCard label={t("clients.form.code")} value={detailsClient.code || "-"} />
              <InfoCard label={t("clients.details.address")} value={detailsClient.address || "-"} />
              <InfoCard label={t("clients.form.city")} value={detailsClient.city || "-"} />
              <InfoCard label={t("clients.form.country")} value={detailsClient.country || "-"} />
              <InfoCard label={t("clients.details.iceIf")} value={`${detailsClient.ice || "-"} / ${detailsClient.ifNumber || "-"}`} />
              <InfoCard label={t("clients.form.notes")} value={detailsClient.notes || "-"} />
              <InfoCard label={t("clients.summary.relatedDocuments")} value={String(detailsClient.documentsCount)} />
              <InfoCard label={t("clients.table.billed")} value={`${detailsClient.totalBilled.toFixed(2)} MAD`} />
              <InfoCard label={t("clients.table.due")} value={`${detailsClient.totalDue.toFixed(2)} MAD`} />
              <InfoCard label={t("clients.summary.totalPaid")} value={`${detailsClient.totalPaid.toFixed(2)} MAD`} />
              <InfoCard label={t("clients.table.updated")} value={detailsClient.updatedAt.slice(0, 10)} />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <UiButton type="button" size="sm" variant="outline" icon={Edit02Icon} label={t("common.edit")} onClick={() => openEditClient(detailsClient)} />
              <UiButton type="button" size="sm" variant="danger" icon={Cancel01Icon} label={t("common.delete")} onClick={() => void runClientAction("delete", detailsClient)} />
            </div>
          </div>
        </div>
      ) : null}

      {editClientId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-md border border-border bg-card/95 p-4 shadow-2xl shadow-black/50">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">{t("clients.edit.title")}</p>
                <h3 className="text-lg font-semibold text-foreground">{editValues.name || "-"}</h3>
              </div>
              <UiButton
                type="button"
                size="xs"
                variant="ghost"
                iconOnly
                iconName="close"
                onClick={() => {
                  if (!isEditSaving) {
                    setEditClientId(null);
                  }
                }}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField type="text" label={t("clients.form.code")} value={editValues.code} onChange={(value) => setEditValues((current) => ({ ...current, code: value }))} />
              <FormField type="text" label={t("clients.table.name")} value={editValues.name} required onChange={(value) => setEditValues((current) => ({ ...current, name: value }))} />
              <FormField type="email" label={t("clients.table.email")} value={editValues.email} onChange={(value) => setEditValues((current) => ({ ...current, email: value }))} />
              <FormField type="text" label={t("clients.table.phone")} value={editValues.phone} onChange={(value) => setEditValues((current) => ({ ...current, phone: value }))} />
              <FormField type="text" label={t("clients.form.phoneFix")} value={editValues.phoneFix} onChange={(value) => setEditValues((current) => ({ ...current, phoneFix: value }))} />
              <FormField type="text" label={t("clients.details.address")} value={editValues.address} onChange={(value) => setEditValues((current) => ({ ...current, address: value }))} />
              <FormField type="text" label={t("clients.form.city")} value={editValues.city} onChange={(value) => setEditValues((current) => ({ ...current, city: value }))} />
              <FormField type="text" label={t("clients.form.country")} value={editValues.country} onChange={(value) => setEditValues((current) => ({ ...current, country: value }))} />
              <FormField type="text" label={t("settings.general.ice")} value={editValues.ice} onChange={(value) => setEditValues((current) => ({ ...current, ice: value }))} />
              <FormField type="text" label={t("settings.general.if")} value={editValues.ifNumber} onChange={(value) => setEditValues((current) => ({ ...current, ifNumber: value }))} />
              <FormField type="text" label={t("clients.form.notes")} value={editValues.notes} onChange={(value) => setEditValues((current) => ({ ...current, notes: value }))} className="md:col-span-2" />
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <UiButton type="button" size="sm" variant="ghost" label={t("common.cancel")} onClick={() => setEditClientId(null)} />
              <UiButton type="button" size="sm" icon={Edit02Icon} label={isEditSaving ? `${t("common.saveChanges")}...` : t("common.saveChanges")} onClick={() => void saveEditedClient()} disabled={isEditSaving} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-md border border-border bg-card/70 p-4">
      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </article>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-3 text-xs">
      <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        <HugIcon icon={UserSquareIcon} size={12} />
        {label}
      </p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>
  );
}
