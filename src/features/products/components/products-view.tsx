"use client";

import { AiSearchIcon, Cancel01Icon, Edit02Icon, EyeIcon, PackageIcon } from "@hugeicons/core-free-icons";
import { useEffect, useMemo, useRef, useState } from "react";

import { ActionMenu } from "@/components/ui/action-menu";
import { FilterField } from "@/components/ui/filter-field";
import { FormField } from "@/components/ui/form-field";
import { HugIcon } from "@/components/ui/hug-icon";
import { useMsgBox } from "@/components/ui/msg-box";
import { useToast } from "@/components/ui/toast";
import { UiButton } from "@/components/ui/ui-button";
import { deleteProductAction, importProductCatalogAction, updateProductAction } from "@/features/products/actions";
import { emitWorkspaceEvent, STORE_EVENTS } from "@/features/documents/lib/workspace-store";
import {
  getCompanyDocumentUnitsAction,
  getCompanyViewPreferenceAction,
  saveCompanyViewPreferenceAction,
} from "@/features/settings/actions";
import { useI18n } from "@/i18n/provider";

type ProductViewMode = "table" | "grid";

type ProductRow = {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  unit: string;
  priceHT: number;
  vatRate: number;
  isActive: boolean;
  documentsCount: number;
  lineItemsCount: number;
  soldQuantity: number;
  revenueHT: number;
  updatedAt: string;
};

type ProductsViewProps = {
  products: ProductRow[];
};

const CATALOG_TEMPLATE_COLUMNS = ["sku", "name", "description", "unit", "price_ht", "vat_rate", "is_active"] as const;
const CATALOG_TEMPLATE_SAMPLE = ["SKU-001", "Article demo", "Optional note", "u", "100.00", "20", "true"] as const;

export function ProductsView({ products }: ProductsViewProps) {
  const { success, error, info } = useToast();
  const { t } = useI18n();
  const { confirm } = useMsgBox();
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<ProductRow[]>(products);
  const [units, setUnits] = useState<string[]>(["u", "kg", "m", "m2", "m3", "h", "jour", "forfait"]);
  const [query, setQuery] = useState("");
  const [vatFilter, setVatFilter] = useState("all");
  const [usageFilter, setUsageFilter] = useState("all");
  const [catalogFile, setCatalogFile] = useState<File | null>(null);
  const [importingCatalog, setImportingCatalog] = useState(false);
  const [viewMode, setViewMode] = useState<ProductViewMode>("table");
  const [detailsProductId, setDetailsProductId] = useState<string | null>(null);
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [editValues, setEditValues] = useState({
    sku: "",
    name: "",
    description: "",
    unit: "",
    priceHT: "0",
    vatRate: "20",
    isActive: true,
  });

  useEffect(() => {
    let mounted = true;
    void getCompanyViewPreferenceAction("products")
      .then((result) => {
        if (!mounted || !result.ok) {
          return;
        }
        if (result.mode === "grid" || result.mode === "table") {
          setViewMode(result.mode);
        }
      })
      .catch(() => {
        // Keep default view mode when preference load fails.
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const syncUnits = () => {
      void getCompanyDocumentUnitsAction().then((result) => {
        if (!mounted || !result.ok) {
          return;
        }
        setUnits(result.units);
      });
    };
    syncUnits();
    window.addEventListener(STORE_EVENTS.unitsUpdated, syncUnits);
    return () => {
      mounted = false;
      window.removeEventListener(STORE_EVENTS.unitsUpdated, syncUnits);
    };
  }, []);

  useEffect(() => {
    setRows(products);
  }, [products]);

  const setMode = (mode: ProductViewMode) => {
    setViewMode(mode);
    void saveCompanyViewPreferenceAction({ scope: "products", mode }).catch(() => {
      // Keep UI mode if DB save fails.
    });
  };

  const resetCatalogFileInput = () => {
    if (importFileInputRef.current) {
      importFileInputRef.current.value = "";
    }
    setCatalogFile(null);
  };

  const downloadCatalogTemplate = () => {
    const csvRows = [CATALOG_TEMPLATE_COLUMNS.join(","), CATALOG_TEMPLATE_SAMPLE.join(",")];
    const blob = new Blob([`\uFEFF${csvRows.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "catalog_template.csv";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    success(t("products.import.templateDownloaded"));
  };

  const importCatalog = async () => {
    if (!catalogFile) {
      error(t("products.import.toasts.fileRequired"));
      return;
    }

    setImportingCatalog(true);
    const formData = new FormData();
    formData.set("file", catalogFile);
    const result = await importProductCatalogAction(formData);
    setImportingCatalog(false);

    if (!result.ok) {
      const summary = "summary" in result && result.summary
        ? t("products.import.toasts.failedHint")
            .replace("{valid}", String(result.summary.validRows || 0))
            .replace("{invalid}", String(result.summary.invalidRows || 0))
        : undefined;
      error(t("products.import.toasts.failed"), result.error || summary);
      return;
    }

    setRows((current) => mergeImportedRows(current, result.products));
    emitWorkspaceEvent(STORE_EVENTS.articlesUpdated);
    const summaryLabel = t("products.import.toasts.successHint")
      .replace("{created}", String(result.summary.createdCount))
      .replace("{updated}", String(result.summary.updatedCount))
      .replace("{duplicates}", String(result.summary.duplicateRows))
      .replace("{invalid}", String(result.summary.invalidRows))
      .replace("{failed}", String(result.summary.failedCount));
    success(t("products.import.toasts.success"), summaryLabel);
    if (result.errors.length > 0) {
      const first = result.errors[0];
      info(t("products.import.toasts.partialIssues"), `Row ${first.rowNumber}: ${first.message}`);
    }
    resetCatalogFileInput();
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((product) => {
      const matchesQuery =
        needle.length === 0 ||
        product.name.toLowerCase().includes(needle) ||
        product.unit.toLowerCase().includes(needle);

      const matchesVat =
        vatFilter === "all" ||
        (vatFilter === "vat_20" && Math.abs(product.vatRate - 20) < 0.001) ||
        (vatFilter === "vat_other" && Math.abs(product.vatRate - 20) >= 0.001);

      const matchesUsage =
        usageFilter === "all" ||
        (usageFilter === "used" && product.documentsCount > 0) ||
        (usageFilter === "unused" && product.documentsCount === 0);

      return matchesQuery && matchesVat && matchesUsage;
    });
  }, [query, rows, usageFilter, vatFilter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const catalogHT = rows.reduce((sum, product) => sum + product.priceHT, 0);
    const soldQuantity = rows.reduce((sum, product) => sum + product.soldQuantity, 0);
    const revenueHT = rows.reduce((sum, product) => sum + product.revenueHT, 0);
    const usedInDocs = rows.reduce((sum, product) => sum + product.documentsCount, 0);
    return {
      total,
      catalogHT,
      soldQuantity,
      revenueHT,
      usedInDocs,
    };
  }, [rows]);

  const detailsProduct = useMemo(() => (detailsProductId ? rows.find((row) => row.id === detailsProductId) ?? null : null), [detailsProductId, rows]);
  const unitOptions = useMemo(() => {
    const source = units.length ? units : ["u"];
    return source.map((unit) => ({ value: unit, label: unit }));
  }, [units]);
  
  const openEditProduct = (product: ProductRow) => {
    setDetailsProductId(null);
    setEditProductId(product.id);
    setEditValues({
      sku: product.sku || "",
      name: product.name || "",
      description: product.description || "",
      unit: product.unit || "",
      priceHT: String(product.priceHT),
      vatRate: String(product.vatRate),
      isActive: product.isActive,
    });
  };

  const saveEditedProduct = async () => {
    if (!editProductId) {
      return;
    }
    if (!editValues.name.trim()) {
      error(t("products.toasts.nameRequired"));
      return;
    }
    if (!editValues.unit.trim()) {
      error(t("products.toasts.unitRequired"));
      return;
    }

    setIsEditSaving(true);
    const result = await updateProductAction({
      productId: editProductId,
      sku: editValues.sku,
      name: editValues.name,
      description: editValues.description,
      unit: editValues.unit,
      priceHT: Number(editValues.priceHT || 0),
      vatRate: Number(editValues.vatRate || 0),
      isActive: editValues.isActive,
    });
    setIsEditSaving(false);

    if (!result.ok) {
      error(t("products.toasts.updateFailed"), result.error);
      return;
    }

    setRows((current) =>
      current.map((item) =>
        item.id === editProductId
          ? {
              ...item,
              ...result.product,
            }
          : item,
      ),
    );
    success(t("products.toasts.updated"), result.product.name);
    setEditProductId(null);
  };

  const runProductAction = async (action: "details" | "edit" | "delete", product: ProductRow) => {
    if (action === "details") {
      setDetailsProductId(product.id);
      return;
    }
    if (action === "edit") {
      openEditProduct(product);
      return;
    }

    const shouldDelete = await confirm({
      title: t("products.confirm.deleteTitle"),
      description: t("products.confirm.deleteDescription").replace("{name}", product.name),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
      variant: "danger",
    });

    if (!shouldDelete) {
      return;
    }

    const result = await deleteProductAction({ productId: product.id });
    if (!result.ok) {
      error(t("products.toasts.deleteFailed"), result.error);
      return;
    }

    setRows((current) => current.filter((row) => row.id !== product.id));
    if (detailsProductId === product.id) {
      setDetailsProductId(null);
    }
    if (editProductId === product.id) {
      setEditProductId(null);
    }
    success(t("products.toasts.deleted"), product.name);
  };

  const renderActions = (product: ProductRow) => (
    <ActionMenu
      triggerAriaLabel={t("products.actions.openActions")}
      menuZIndex={30}
      sections={[
        {
          id: "actions",
          items: [
            { id: "details", label: t("common.details"), icon: EyeIcon, onSelect: () => void runProductAction("details", product) },
            { id: "edit", label: t("common.edit"), icon: Edit02Icon, onSelect: () => void runProductAction("edit", product) },
            { id: "delete", label: t("common.delete"), icon: Cancel01Icon, onSelect: () => void runProductAction("delete", product) },
          ],
        },
      ]}
    />
  );

  return (
    <div className="space-y-4">
      <div className="relative z-40 space-y-3 rounded-md border border-border bg-card/70 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_220px_auto]">
          <FilterField
            value={query}
            placeholder={t("products.filters.searchPlaceholder")}
            icon={<HugIcon icon={AiSearchIcon} size={14} />}
            onChange={setQuery}
          />
          <FilterField
            value={vatFilter}
            onChange={setVatFilter}
            options={[
              { value: "all", label: t("products.filters.allVat") },
              { value: "vat_20", label: t("products.filters.vat20") },
              { value: "vat_other", label: t("products.filters.otherVat") },
            ]}
          />
          <FilterField
            value={usageFilter}
            onChange={setUsageFilter}
            options={[
              { value: "all", label: t("products.filters.allProducts") },
              { value: "used", label: t("products.filters.used") },
              { value: "unused", label: t("products.filters.unused") },
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

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label={t("products.summary.totalProducts")} value={String(stats.total)} />
        <SummaryCard label={t("products.summary.catalogHtSum")} value={`${stats.catalogHT.toFixed(2)} MAD`} />
        <SummaryCard label={t("products.summary.usedInDocuments")} value={String(stats.usedInDocs)} />
        <SummaryCard label={t("products.summary.soldQuantity")} value={stats.soldQuantity.toFixed(3)} />
        <SummaryCard label={t("products.summary.revenueHt")} value={`${stats.revenueHT.toFixed(2)} MAD`} />
      </div>

      <div className="rounded-md border border-border bg-card/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t("products.import.title")}</p>
            <p className="text-xs text-muted-foreground">{t("products.import.subtitle")}</p>
            <p className="text-[11px] text-muted-foreground">{t("products.import.columns")}: {CATALOG_TEMPLATE_COLUMNS.join(", ")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <UiButton type="button" size="sm" variant="outline" iconName="export" onClick={downloadCatalogTemplate}>
              {t("products.import.downloadTemplate")}
            </UiButton>
            <UiButton
              type="button"
              size="sm"
              variant="outline"
              iconName="import"
              onClick={() => importFileInputRef.current?.click()}
            >
              {catalogFile ? t("products.import.replaceFile") : t("products.import.selectFile")}
            </UiButton>
            <UiButton
              type="button"
              size="sm"
              variant="primary"
              onClick={() => void importCatalog()}
              disabled={!catalogFile || importingCatalog}
            >
              {importingCatalog ? t("products.import.importing") : t("products.import.importNow")}
            </UiButton>
          </div>
        </div>
        <input
          ref={importFileInputRef}
          type="file"
          accept=".csv,.xls,.xlsx"
          className="hidden"
          onChange={(event) => setCatalogFile(event.target.files?.[0] ?? null)}
        />
        <p className="mt-2 text-[11px] text-muted-foreground">
          {catalogFile
            ? t("products.import.selectedFile").replace("{name}", catalogFile.name)
            : t("products.import.acceptedFormats")}
        </p>
      </div>

      {viewMode === "table" ? (
        <div className="overflow-x-auto rounded-md border border-border bg-card/70">
          <table className="w-full text-sm">
            <thead className="bg-background/70 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start">{t("products.table.designation")}</th>
                <th className="px-4 py-3 text-start">{t("products.table.unit")}</th>
                <th className="px-4 py-3 text-start">{t("products.table.unitPriceHt")}</th>
                <th className="px-4 py-3 text-start">{t("products.table.tva")}</th>
                <th className="px-4 py-3 text-start">{t("products.table.documents")}</th>
                <th className="px-4 py-3 text-start">{t("products.table.soldQty")}</th>
                <th className="px-4 py-3 text-start">{t("products.table.revenueHt")}</th>
                <th className="px-4 py-3 text-start">{t("products.table.updated")}</th>
                <th className="px-4 py-3 text-start">{t("products.table.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card/50 text-xs text-muted-foreground">
              {filtered.length ? (
                filtered.map((product) => (
                  <tr key={product.id}>
                    <td className="px-4 py-3 text-foreground">{product.name}</td>
                    <td className="px-4 py-3">{product.unit}</td>
                    <td className="px-4 py-3">{product.priceHT.toFixed(2)} MAD</td>
                    <td className="px-4 py-3">{product.vatRate.toFixed(2)}%</td>
                    <td className="px-4 py-3">{product.documentsCount}</td>
                    <td className="px-4 py-3">{product.soldQuantity.toFixed(3)}</td>
                    <td className="px-4 py-3">{product.revenueHT.toFixed(2)} MAD</td>
                    <td className="px-4 py-3">{product.updatedAt.slice(0, 10)}</td>
                    <td className="px-4 py-3">{renderActions(product)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-xs text-muted-foreground">
                    {t("products.table.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-3">
          {filtered.length ? (
            filtered.map((product) => (
              <article key={product.id} className="space-y-2 rounded-md border border-border/80 bg-card/65 p-3">
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-tight text-foreground">{product.name}</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{product.sku || "-"}</p>
                  </div>
                  {renderActions(product)}
                </div>

                <div className="grid grid-cols-2 gap-1 rounded-md border border-border bg-background/25 px-2 py-1.5 text-[11px]">
                  <p className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("products.table.unit")}</span>
                    <span className="font-semibold text-foreground">{product.unit}</span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("products.table.tva")}</span>
                    <span className="font-semibold text-foreground">{product.vatRate.toFixed(2)}%</span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("products.table.documents")}</span>
                    <span className="font-semibold text-foreground">{product.documentsCount}</span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("products.table.soldQty")}</span>
                    <span className="font-semibold text-foreground">{product.soldQuantity.toFixed(3)}</span>
                  </p>
                </div>

                <p className="truncate text-[11px] text-muted-foreground">{product.description || "-"}</p>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-muted-foreground">{product.updatedAt.slice(0, 10)}</span>
                  <span className="font-semibold text-foreground">{product.priceHT.toFixed(2)} MAD</span>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-md border border-border bg-card/70 p-6 text-center text-xs text-muted-foreground sm:col-span-2 lg:col-span-3 2xl:col-span-4">
              {t("products.table.empty")}
            </div>
          )}
        </div>
      )}

      {detailsProduct ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-md border border-border bg-card/95 p-4 shadow-2xl shadow-black/50">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">{t("products.details.title")}</p>
                <h3 className="text-lg font-semibold text-foreground">{detailsProduct.name}</h3>
              </div>
              <UiButton type="button" size="xs" variant="ghost" iconOnly iconName="close" onClick={() => setDetailsProductId(null)} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <InfoCard label={t("products.table.designation")} value={detailsProduct.name} />
              <InfoCard label={t("products.form.sku")} value={detailsProduct.sku || "-"} />
              <InfoCard label={t("products.form.description")} value={detailsProduct.description || "-"} />
              <InfoCard label={t("products.table.unit")} value={detailsProduct.unit} />
              <InfoCard label={t("products.form.active")} value={detailsProduct.isActive ? t("common.yes") : t("common.no")} />
              <InfoCard label={t("products.table.unitPriceHt")} value={`${detailsProduct.priceHT.toFixed(2)} MAD`} />
              <InfoCard label={t("products.table.tva")} value={`${detailsProduct.vatRate.toFixed(2)}%`} />
              <InfoCard label={t("products.summary.usedInDocuments")} value={String(detailsProduct.documentsCount)} />
              <InfoCard label={t("products.summary.soldQuantity")} value={detailsProduct.soldQuantity.toFixed(3)} />
              <InfoCard label={t("products.summary.revenueHt")} value={`${detailsProduct.revenueHT.toFixed(2)} MAD`} />
              <InfoCard label={t("products.table.updated")} value={detailsProduct.updatedAt.slice(0, 10)} />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <UiButton type="button" size="sm" variant="outline" icon={Edit02Icon} label={t("common.edit")} onClick={() => openEditProduct(detailsProduct)} />
              <UiButton type="button" size="sm" variant="danger" icon={Cancel01Icon} label={t("common.delete")} onClick={() => void runProductAction("delete", detailsProduct)} />
            </div>
          </div>
        </div>
      ) : null}

      {editProductId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-md border border-border bg-card/95 p-4 shadow-2xl shadow-black/50">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">{t("products.edit.title")}</p>
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
                    setEditProductId(null);
                  }
                }}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField type="text" label={t("products.table.designation")} value={editValues.name} required onChange={(value) => setEditValues((current) => ({ ...current, name: value }))} />
              <FormField type="text" label={t("products.form.sku")} value={editValues.sku} onChange={(value) => setEditValues((current) => ({ ...current, sku: value }))} />
              <FormField
                type="select"
                label={t("products.table.unit")}
                value={editValues.unit}
                options={
                  unitOptions.some((option) => option.value === editValues.unit)
                    ? unitOptions
                    : [{ value: editValues.unit, label: editValues.unit }, ...unitOptions]
                }
                required
                onChange={(value) => setEditValues((current) => ({ ...current, unit: value }))}
              />
              <FormField type="number" label={t("products.table.unitPriceHt")} value={editValues.priceHT} min="0" step="0.01" onChange={(value) => setEditValues((current) => ({ ...current, priceHT: value }))} />
              <FormField type="number" label={t("products.table.tva")} value={editValues.vatRate} min="0" max="100" step="0.01" onChange={(value) => setEditValues((current) => ({ ...current, vatRate: value }))} />
              <FormField type="checkbox" label={t("products.form.active")} checked={editValues.isActive} onCheckedChange={(checked) => setEditValues((current) => ({ ...current, isActive: checked }))} />
              <FormField type="text" label={t("products.form.description")} value={editValues.description} onChange={(value) => setEditValues((current) => ({ ...current, description: value }))} className="md:col-span-2" />
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <UiButton type="button" size="sm" variant="ghost" label={t("common.cancel")} onClick={() => setEditProductId(null)} />
              <UiButton type="button" size="sm" icon={Edit02Icon} label={isEditSaving ? `${t("common.saveChanges")}...` : t("common.saveChanges")} onClick={() => void saveEditedProduct()} disabled={isEditSaving} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function mergeImportedRows(
  currentRows: ProductRow[],
  importedRows: Array<{
    id: string;
    sku: string | null;
    name: string;
    description: string | null;
    unit: string;
    priceHT: number;
    vatRate: number;
    isActive: boolean;
    updatedAt: string;
  }>,
) {
  const byId = new Map(currentRows.map((row) => [row.id, row]));
  for (const imported of importedRows) {
    const existing = byId.get(imported.id);
    byId.set(imported.id, {
      id: imported.id,
      sku: imported.sku,
      name: imported.name,
      description: imported.description,
      unit: imported.unit,
      priceHT: imported.priceHT,
      vatRate: imported.vatRate,
      isActive: imported.isActive,
      updatedAt: imported.updatedAt,
      documentsCount: existing?.documentsCount || 0,
      lineItemsCount: existing?.lineItemsCount || 0,
      soldQuantity: existing?.soldQuantity || 0,
      revenueHT: existing?.revenueHT || 0,
    });
  }
  return Array.from(byId.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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
        <HugIcon icon={PackageIcon} size={12} />
        {label}
      </p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>
  );
}
