"use client";

import {
  AddInvoiceIcon,
  CirclePlus,
  DeliveryTruck01Icon,
  FileSearchIcon,
  LegalDocument02Icon,
  QuotesIcon,
  ReceiptDollarIcon,
  SendingOrderIcon,
} from "@hugeicons/core-free-icons";
import { useEffect, useMemo, useState } from "react";

import { FormField } from "@/components/ui/form-field";
import { HugIcon } from "@/components/ui/hug-icon";
import { useMsgBox } from "@/components/ui/msg-box";
import { useToast } from "@/components/ui/toast";
import { UiButton } from "@/components/ui/ui-button";
import {
  applyEmailTemplateVariables,
  emitWorkspaceEvent,
  DocumentType,
  STORE_EVENTS,
  StoredArticle,
  DOCUMENT_TYPE_OPTIONS,
  TemplateLineColumn,
} from "@/features/documents/lib/workspace-store";
import {
  createDocumentFromDraftAction,
  getDocumentFormLibrariesAction,
  updateDocumentFromDraftAction,
  upsertClientFromDocumentAction,
  upsertProductFromDocumentAction,
} from "@/features/documents/actions";
import {
  getCompanyBusinessConfigAction,
  getCompanyDocumentUnitsAction,
  getCompanyEmailTemplatesAction,
  getCompanyTemplateColumnsAction,
  saveCompanyDocumentUnitsAction,
} from "@/features/settings/actions";
import { useI18n } from "@/i18n/provider";

type WizardStep = "type" | "client" | "articles";
type LineDraft = {
  id: string;
  values: Record<string, string>;
};

type ClientLibraryRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  ice?: string;
  ifNumber?: string;
  createdAt: string;
  updatedAt: string;
};

export type DocumentSavedRow = {
  id: string;
  number: string;
  type: (typeof DOCUMENT_TYPE_OPTIONS)[number];
  client: string;
  status: string;
  total: string;
  issueDate: string;
};

export type DocumentEditorInitialData = {
  id: string;
  number: string;
  type: DocumentType;
  status: string;
  issueDate: string;
  dueDate: string | null;
  tvaRate: number;
  client: {
    id?: string | null;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    ice?: string;
    ifNumber?: string;
  };
  lines: Record<string, string>[];
};

type NewDocumentModalProps = {
  hideTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialDocument?: DocumentEditorInitialData | null;
  onDocumentSaved?: (document: DocumentSavedRow) => void;
};

const documentTypeIcons: Record<DocumentType, unknown> = {
  DEVIS: QuotesIcon,
  FACTURE: ReceiptDollarIcon,
  FACTURE_PROFORMA: AddInvoiceIcon,
  BON_LIVRAISON: DeliveryTruck01Icon,
  BON_COMMANDE: SendingOrderIcon,
  EXTRACT_DEVIS: FileSearchIcon,
  EXTRACT_BON_COMMANDE_PUBLIC: LegalDocument02Icon,
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

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function parseNumber(value: string) {
  const normalized = value.replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasPositiveUnitPrice(value: string | undefined) {
  return parseNumber(value || "0") > 0;
}

function computePt(values: Record<string, string>) {
  return parseNumber(values.qte || "0") * parseNumber(values.pu || "0");
}

function toDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysToDateInput(dateInput: string, days: number) {
  const base = new Date(`${dateInput}T00:00:00`);
  if (Number.isNaN(base.getTime())) {
    return "";
  }
  base.setDate(base.getDate() + days);
  return toDateInputValue(base);
}

function resolveDefaultUnit(units: string[]) {
  return units.find((unit) => unit.trim().length > 0) || "u";
}

function normalizeUnitInput(value: string) {
  return value.trim();
}

function normalizeSelectOptions(options: string[] | undefined) {
  if (!options?.length) {
    return [] as string[];
  }
  const normalized = options
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return Array.from(new Set(normalized));
}

function normalizeLineValues(values: Record<string, string>, defaultUnit = "u") {
  return {
    ...values,
    designation: values.designation || "",
    unite: values.unite || defaultUnit,
    qte: values.qte || "1",
    pu: values.pu || "0",
    pt: computePt(values).toFixed(2),
  };
}

function rowFromColumns(columns: TemplateLineColumn[], seedValues: Record<string, string> = {}, defaultUnit = "u"): LineDraft {
  const values: Record<string, string> = {};
  for (const column of columns) {
    values[column.id] = seedValues[column.id] || "";
  }
  return {
    id: randomId(),
    values: normalizeLineValues({ ...values, ...seedValues }, defaultUnit),
  };
}

function getDefaultType(enabledTypes: DocumentType[]) {
  return enabledTypes[0] ?? "DEVIS";
}

const DEFAULT_UNITS = ["u", "kg", "m", "m2", "m3", "h", "jour", "forfait"];
const DEFAULT_TEMPLATE_COLUMNS: TemplateLineColumn[] = [
  { id: "designation", label: "Designation", dataType: "text", required: true, enabled: true, system: true },
  { id: "unite", label: "Unite", dataType: "unit", required: false, enabled: true, system: true },
  { id: "qte", label: "Qte", dataType: "number", required: true, enabled: true, system: true },
  { id: "pu", label: "P.U HT", dataType: "currency", required: true, enabled: true, system: true },
  { id: "pt", label: "P.T HT", dataType: "currency", required: false, enabled: true, system: true },
];
const DEFAULT_EMAIL_TEMPLATE = {
  enabled: true,
  autoSendOnCreate: false,
  subject: "",
  body: "",
};

function createDefaultEmailTemplates(): EmailTemplateSettings {
  const output = {} as EmailTemplateSettings;
  for (const documentType of DOCUMENT_TYPE_OPTIONS) {
    output[documentType] = { ...DEFAULT_EMAIL_TEMPLATE };
  }
  return output;
}

export function NewDocumentModal({
  hideTrigger = false,
  open,
  onOpenChange,
  initialDocument = null,
  onDocumentSaved,
}: NewDocumentModalProps) {
  const { success, error, info } = useToast();
  const { confirm } = useMsgBox();
  const { t } = useI18n();
  const [localOpen, setLocalOpen] = useState(false);
  const isControlled = typeof open === "boolean";
  const isOpen = isControlled ? open : localOpen;
  const isEditing = Boolean(initialDocument?.id);
  const [step, setStep] = useState<WizardStep>("type");
  const [enabledTypes, setEnabledTypes] = useState<DocumentType[]>(["DEVIS", "FACTURE", "FACTURE_PROFORMA", "BON_LIVRAISON", "BON_COMMANDE"]);
  const [type, setType] = useState<DocumentType>("DEVIS");
  const [tvaRate, setTvaRate] = useState<number>(20);
  const [autoFillArticleUnitPrice, setAutoFillArticleUnitPrice] = useState<boolean>(true);
  const [issueDate, setIssueDate] = useState<string>(() => toDateInputValue(new Date()));
  const [dueDate, setDueDate] = useState<string>("");
  const [dueDateTouched, setDueDateTouched] = useState(false);

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientIce, setClientIce] = useState("");
  const [clientIf, setClientIf] = useState("");

  const [units, setUnits] = useState<string[]>(DEFAULT_UNITS);
  const [defaultUnit, setDefaultUnit] = useState(() => resolveDefaultUnit(DEFAULT_UNITS));
  const [columns, setColumns] = useState<TemplateLineColumn[]>(() => DEFAULT_TEMPLATE_COLUMNS.filter((column) => column.enabled));
  const [lines, setLines] = useState<LineDraft[]>(() => [
    rowFromColumns(DEFAULT_TEMPLATE_COLUMNS.filter((column) => column.enabled), {}, resolveDefaultUnit(DEFAULT_UNITS)),
  ]);
  const [savedClients, setSavedClients] = useState<ClientLibraryRow[]>([]);
  const [savedArticles, setSavedArticles] = useState<StoredArticle[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateSettings>(() => createDefaultEmailTemplates());
  const [articleQuery, setArticleQuery] = useState("");
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);

  const requiredClientReady = useMemo(() => {
    return clientName.trim().length > 1 && clientPhone.trim().length > 1 && clientAddress.trim().length > 2;
  }, [clientAddress, clientName, clientPhone]);
  const requiresDueDate = type === "FACTURE";
  const dueDateReady = !requiresDueDate || dueDate.trim().length > 0;

  const validLines = useMemo(() => lines.filter((line) => line.values.designation?.trim().length > 0), [lines]);
  const linesMissingUnitPrice = useMemo(
    () => validLines.filter((line) => !hasPositiveUnitPrice(line.values.pu)),
    [validLines],
  );
  const unitPriceReady = linesMissingUnitPrice.length === 0;
  const canCreate = requiredClientReady && dueDateReady && validLines.length > 0 && unitPriceReady;
  const selectedLinesCount = selectedLineIds.length;
  const allLinesSelected = lines.length > 0 && selectedLinesCount === lines.length;

  const subtotalHT = useMemo(() => {
    return validLines.reduce((total, line) => total + computePt(line.values), 0);
  }, [validLines]);
  const totalTax = useMemo(() => subtotalHT * (tvaRate / 100), [subtotalHT, tvaRate]);
  const totalTTC = useMemo(() => subtotalHT + totalTax, [subtotalHT, totalTax]);

  const suggestedArticles = useMemo(() => {
    const query = articleQuery.trim().toLowerCase();
    const source = query
      ? savedArticles.filter((article) => article.designation.toLowerCase().includes(query))
      : savedArticles;
    return source.slice(0, 10);
  }, [articleQuery, savedArticles]);
  const baseUnitOptions = useMemo(() => {
    const source = units.length ? units : [defaultUnit];
    return source.map((unit) => ({ value: unit, label: unit }));
  }, [defaultUnit, units]);
  const orderedLineColumns = useMemo(() => {
    const designationColumn = columns.find((column) => column.id === "designation");
    const otherColumns = columns.filter((column) => column.id !== "designation");
    return designationColumn ? [designationColumn, ...otherColumns] : columns;
  }, [columns]);
  const documentTypeLabel = (documentType: DocumentType) => t(DOCUMENT_TYPE_I18N_KEYS[documentType] || "documents.types.devis");

  const setOpenState = (next: boolean) => {
    if (!isControlled) {
      setLocalOpen(next);
    }
    onOpenChange?.(next);
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    let mounted = true;
    const loadRuntimeData = async () => {
      const [librariesResult, businessResult, unitsResult, templatesResult] = await Promise.all([
        getDocumentFormLibrariesAction(),
        getCompanyBusinessConfigAction(),
        getCompanyDocumentUnitsAction(),
        getCompanyEmailTemplatesAction(),
      ]);
      if (!mounted) {
        return;
      }

      const configuredTypes = businessResult.ok
        ? (businessResult.config.enabledDocumentTypes as DocumentType[])
        : ["DEVIS", "FACTURE", "FACTURE_PROFORMA", "BON_LIVRAISON", "BON_COMMANDE"];
      const preferredType = initialDocument
        ? initialDocument.type
        : getDefaultType(configuredTypes);
      const nextEnabledTypes =
        initialDocument && !configuredTypes.includes(preferredType)
          ? [preferredType, ...configuredTypes]
          : configuredTypes;
      const nextType =
        initialDocument
          ? preferredType
          : (nextEnabledTypes.includes(preferredType) ? preferredType : getDefaultType(nextEnabledTypes));

      const columnsResult = await getCompanyTemplateColumnsAction(nextType);
      if (!mounted) {
        return;
      }
      const nextColumns = columnsResult.ok
        ? (columnsResult.columns as TemplateLineColumn[]).filter((column) => column.enabled)
        : DEFAULT_TEMPLATE_COLUMNS.filter((column) => column.enabled);
      const nextUnits = unitsResult.ok ? unitsResult.units : DEFAULT_UNITS;
      const nextDefaultUnit = resolveDefaultUnit(nextUnits);

      setEnabledTypes(nextEnabledTypes);
      setType(nextType);
      setTvaRate(businessResult.ok ? businessResult.config.defaultTvaRate : 20);
      setAutoFillArticleUnitPrice(businessResult.ok ? businessResult.config.autoFillArticleUnitPrice : true);
      setUnits(nextUnits);
      setDefaultUnit(nextDefaultUnit);
      setColumns(nextColumns);
      setSavedClients(librariesResult.ok ? librariesResult.clients as ClientLibraryRow[] : []);
      setSavedArticles(librariesResult.ok ? librariesResult.articles : []);
      setEmailTemplates(templatesResult.ok ? templatesResult.templates as EmailTemplateSettings : createDefaultEmailTemplates());

      if (initialDocument) {
        const mappedLines = initialDocument.lines.length
          ? initialDocument.lines.map((line) => rowFromColumns(nextColumns, line, nextDefaultUnit))
          : [rowFromColumns(nextColumns, {}, nextDefaultUnit)];
        setIssueDate((initialDocument.issueDate || new Date().toISOString()).slice(0, 10));
        setDueDate((initialDocument.dueDate || "").slice(0, 10));
        setDueDateTouched(Boolean(initialDocument.dueDate));
        setLines(mappedLines);
        setClientName(initialDocument.client.name || "");
        setClientEmail(initialDocument.client.email || "");
        setClientPhone(initialDocument.client.phone || "");
        setClientAddress(initialDocument.client.address || "");
        setClientIce(initialDocument.client.ice || "");
        setClientIf(initialDocument.client.ifNumber || "");
        setEditingClientId(initialDocument.client.id || null);
        setArticleQuery("");
        setSelectedLineIds([]);
        setStep("client");
        return;
      }

      const today = toDateInputValue(new Date());
      setIssueDate(today);
      setDueDate(nextType === "FACTURE" ? addDaysToDateInput(today, 30) : "");
      setDueDateTouched(false);
      setLines([rowFromColumns(nextColumns, {}, nextDefaultUnit)]);
      setClientName("");
      setClientEmail("");
      setClientPhone("");
      setClientAddress("");
      setClientIce("");
      setClientIf("");
      setEditingClientId(null);
      setArticleQuery("");
      setSelectedLineIds([]);
      setStep("type");
    };

    void loadRuntimeData();
    return () => {
      mounted = false;
    };
  }, [initialDocument, isOpen]);

  const resetWizard = (nextType: DocumentType) => {
    const nextDefaultUnit = resolveDefaultUnit(units);
    const today = toDateInputValue(new Date());
    setStep("type");
    setIssueDate(today);
    setDueDate(nextType === "FACTURE" ? addDaysToDateInput(today, 30) : "");
    setDueDateTouched(false);
    setClientName("");
    setClientEmail("");
    setClientPhone("");
    setClientAddress("");
    setClientIce("");
    setClientIf("");
    setEditingClientId(null);
    setDefaultUnit(nextDefaultUnit);
    setLines([rowFromColumns(columns, {}, nextDefaultUnit)]);
    setArticleQuery("");
    setSelectedLineIds([]);
  };

  const openModal = () => {
    setOpenState(true);
  };

  const closeModal = () => {
    setOpenState(false);
    if (!isEditing) {
      resetWizard(type);
    }
  };

  const updateType = (nextType: DocumentType) => {
    setType(nextType);
    if (nextType === "FACTURE") {
      if (!dueDateTouched || !dueDate) {
        setDueDate(addDaysToDateInput(issueDate, 30));
      }
    } else {
      setDueDate("");
      setDueDateTouched(false);
    }
    void getCompanyTemplateColumnsAction(nextType)
      .then((result) => {
        const nextColumns = result.ok
          ? (result.columns as TemplateLineColumn[]).filter((column) => column.enabled)
          : DEFAULT_TEMPLATE_COLUMNS.filter((column) => column.enabled);
        const nextDefaultUnit = resolveDefaultUnit(units);
        setColumns(nextColumns);
        setSelectedLineIds([]);
        setLines((current) => {
          const mapped = current.map((line) => rowFromColumns(nextColumns, line.values, nextDefaultUnit));
          return mapped.length ? mapped : [rowFromColumns(nextColumns, {}, nextDefaultUnit)];
        });
      })
      .catch(() => {
        const nextColumns = DEFAULT_TEMPLATE_COLUMNS.filter((column) => column.enabled);
        const nextDefaultUnit = resolveDefaultUnit(units);
        setColumns(nextColumns);
        setSelectedLineIds([]);
        setLines((current) => {
          const mapped = current.map((line) => rowFromColumns(nextColumns, line.values, nextDefaultUnit));
          return mapped.length ? mapped : [rowFromColumns(nextColumns, {}, nextDefaultUnit)];
        });
      });
  };

  const onIssueDateChange = (value: string) => {
    setIssueDate(value);
    if (type === "FACTURE" && !dueDateTouched) {
      setDueDate(addDaysToDateInput(value, 30));
    }
  };

  const onDueDateChange = (value: string) => {
    setDueDate(value);
    setDueDateTouched(true);
  };

  const syncClientFromLibrary = (value: string) => {
    const hit = savedClients.find((item) => item.name.trim().toLowerCase() === value.trim().toLowerCase());
    if (!hit) {
      setEditingClientId(null);
      return;
    }
    setEditingClientId(hit.id);
    setClientName(hit.name);
    setClientEmail(hit.email);
    setClientPhone(hit.phone);
    setClientAddress(hit.address);
    setClientIce(hit.ice || "");
    setClientIf(hit.ifNumber || "");
  };

  const onClientNameChange = (value: string) => {
    setClientName(value);
    setEditingClientId(null);
    syncClientFromLibrary(value);
  };

  const addLine = (seedValues: Record<string, string> = {}) => {
    setLines((current) => [...current, rowFromColumns(columns, seedValues, defaultUnit)]);
  };

  const addLineFromArticle = (article: StoredArticle) => {
    addLine(article.values);
    info(t("documents.form.toasts.articleAdded"), article.designation);
  };

  const removeLine = (lineId: string) => {
    setSelectedLineIds((current) => current.filter((id) => id !== lineId));
    setLines((current) => {
      const next = current.filter((line) => line.id !== lineId);
      return next.length ? next : [rowFromColumns(columns, {}, defaultUnit)];
    });
  };

  const updateLine = (lineId: string, columnId: string, value: string) => {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== lineId) {
          return line;
        }
        const nextValues = normalizeLineValues({
          ...line.values,
          [columnId]: value,
        }, defaultUnit);
        return {
          ...line,
          values: nextValues,
        };
      }),
    );
  };

  const persistUnits = (inputUnits: string[], notify = false) => {
    const existing = new Set(units.map((unit) => unit.trim().toLowerCase()));
    const additions: string[] = [];
    for (const raw of inputUnits) {
      const next = normalizeUnitInput(raw);
      if (!next) {
        continue;
      }
      const key = next.toLowerCase();
      if (existing.has(key)) {
        continue;
      }
      existing.add(key);
      additions.push(next);
    }
    if (!additions.length) {
      return;
    }
    const nextUnits = [...units, ...additions];
    setUnits(nextUnits);
    setDefaultUnit(resolveDefaultUnit(nextUnits));
    void saveCompanyDocumentUnitsAction(nextUnits)
      .then((result) => {
        if (!result.ok) {
          return;
        }
        setUnits(result.units);
        setDefaultUnit(resolveDefaultUnit(result.units));
        emitWorkspaceEvent(STORE_EVENTS.unitsUpdated);
      })
      .catch(() => {
        // Keep in-memory units if DB save fails.
      });
    if (notify) {
      const detail = additions.length === 1 ? additions[0] : t("documents.form.toasts.unitsAddedHint").replace("{count}", String(additions.length));
      info(t("documents.form.toasts.unitAdded"), detail);
    }
  };

  const findArticleInLibrary = (designation: string) =>
    savedArticles.find((article) => article.designation.trim().toLowerCase() === designation.trim().toLowerCase()) ?? null;

  const tryAutoFillArticle = (lineId: string, designation: string) => {
    const hit = findArticleInLibrary(designation);
    if (!hit) {
      return;
    }
    setLines((current) =>
      current.map((line) => {
        if (line.id !== lineId) {
          return line;
        }
        return {
          ...line,
          values: normalizeLineValues({
            ...line.values,
            ...hit.values,
            pu: autoFillArticleUnitPrice ? (hit.values.pu ?? line.values.pu) : line.values.pu,
            designation: hit.designation,
          }, defaultUnit),
        };
      }),
    );
  };

  const lineFieldLabel = (column: TemplateLineColumn) => {
    if (column.id === "designation") {
      return t("documents.form.designation");
    }
    if (column.id === "unite") {
      return t("documents.form.unit");
    }
    if (column.id === "qte") {
      return t("documents.form.qty");
    }
    if (column.id === "pu") {
      return t("documents.form.unitPriceHT");
    }
    if (column.id === "pt") {
      return t("documents.form.lineTotalHT");
    }
    return column.label;
  };

  const updateLineImageFromFile = (lineId: string, columnId: string, file: File | null) => {
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      error(t("documents.form.toasts.imageInvalidType"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        error(t("documents.form.toasts.imageLoadFailed"));
        return;
      }
      updateLine(lineId, columnId, reader.result);
    };
    reader.onerror = () => {
      error(t("documents.form.toasts.imageLoadFailed"));
    };
    reader.readAsDataURL(file);
  };

  const renderLineField = (line: LineDraft, column: TemplateLineColumn) => {
    if (column.id === "designation") {
      return (
        <FormField
          type="text"
          label={lineFieldLabel(column)}
          value={line.values.designation || ""}
          list="saved-articles-list"
          onBlur={(value) => tryAutoFillArticle(line.id, value)}
          onChange={(value) => {
            updateLine(line.id, "designation", value);
            tryAutoFillArticle(line.id, value);
          }}
          placeholder={t("documents.form.designation")}
          inputClassName="h-9 text-[12px]"
        />
      );
    }

    const isSelectField = column.dataType === "select";
    const isImageField = column.dataType === "image";
    const isUnitField = column.dataType === "unit" || column.id === "unite";
    const isReadOnlyTotal = column.id === "pt";
    const isNumericField =
      column.dataType === "number" ||
      column.dataType === "currency" ||
      column.id === "qte" ||
      column.id === "pu" ||
      isReadOnlyTotal;
    const value =
      column.id === "unite"
        ? (line.values.unite || defaultUnit)
        : (line.values[column.id] || "");

    if (isImageField) {
      const fileInputId = `line-${line.id}-${column.id}-image`;
      return (
        <div className="grid gap-1 text-xs">
          <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{lineFieldLabel(column)}</span>
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-background/40 p-1.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background/60">
              {value ? (
                // `value` can be a URL or a data URL.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={value} alt={lineFieldLabel(column)} className="h-full w-full object-contain" />
              ) : (
                <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">img</span>
              )}
            </div>
            <FormField
              type="text"
              value={value}
              onChange={(next) => updateLine(line.id, column.id, next)}
              placeholder={t("documents.form.imageUrlPlaceholder")}
              className="min-w-0 flex-1"
              inputClassName="h-8 text-[11px]"
            />
            <input
              id={fileInputId}
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0] ?? null;
                updateLineImageFromFile(line.id, column.id, file);
                event.currentTarget.value = "";
              }}
              className="hidden"
            />
            <UiButton
              type="button"
              size="xs"
              variant="outline"
              onClick={() => {
                const element = document.getElementById(fileInputId) as HTMLInputElement | null;
                element?.click();
              }}
            >
              {t("documents.form.imageUpload")}
            </UiButton>
            {value ? (
              <UiButton
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => updateLine(line.id, column.id, "")}
              >
                {t("documents.form.imageRemove")}
              </UiButton>
            ) : null}
          </div>
        </div>
      );
    }

    if (isSelectField) {
      const selectOptions = normalizeSelectOptions(column.selectOptions);
      if (selectOptions.length === 0) {
        return (
          <FormField
            type="text"
            label={lineFieldLabel(column)}
            value={value}
            onChange={(next) => updateLine(line.id, column.id, next)}
            placeholder={t("documents.form.selectPlaceholder")}
            hint={t("documents.form.selectNoOptions")}
            inputClassName="h-9 text-[12px]"
          />
        );
      }
      return (
        <FormField
          type="select"
          label={lineFieldLabel(column)}
          value={value}
          onChange={(next) => updateLine(line.id, column.id, next)}
          options={[
            { value: "", label: t("documents.form.selectPlaceholder") },
            ...selectOptions.map((option) => ({ value: option, label: option })),
          ]}
          inputClassName="h-9 text-[12px]"
        />
      );
    }

    if (isUnitField) {
      return (
        <FormField
          type="text"
          label={lineFieldLabel(column)}
          value={value}
          list="saved-units-list"
          placeholder={t("documents.form.unitPlaceholder")}
          onChange={(next) => updateLine(line.id, column.id, next)}
          onBlur={(next) => {
            const normalized = normalizeUnitInput(next);
            if (column.id === "unite") {
              const safe = normalized || defaultUnit;
              updateLine(line.id, column.id, safe);
              persistUnits([safe], true);
              return;
            }
            updateLine(line.id, column.id, normalized);
            if (normalized) {
              persistUnits([normalized], true);
            }
          }}
          inputClassName="h-9 text-center text-[12px]"
        />
      );
    }

    if (isNumericField) {
      const step =
        column.id === "qte"
          ? "0.001"
          : (column.dataType === "currency" || column.id === "pu" || column.id === "pt")
            ? "0.01"
            : "1";
      return (
        <FormField
          type="number"
          label={lineFieldLabel(column)}
          value={value}
          readOnly={isReadOnlyTotal}
          onChange={(next) => updateLine(line.id, column.id, next)}
          min="0"
          step={step}
          inputClassName={
            isReadOnlyTotal
              ? "h-9 bg-background/40 text-end text-[12px] font-semibold tabular-nums"
              : "h-9 text-end text-[12px] tabular-nums"
          }
        />
      );
    }

    return (
      <FormField
        type="text"
        label={lineFieldLabel(column)}
        value={value}
        onChange={(next) => updateLine(line.id, column.id, next)}
        inputClassName="h-9 text-[12px]"
      />
    );
  };

  const toggleLineSelection = (lineId: string) => {
    setSelectedLineIds((current) => (current.includes(lineId) ? current.filter((id) => id !== lineId) : [...current, lineId]));
  };

  const toggleSelectAllLines = () => {
    setSelectedLineIds((current) => (current.length === lines.length ? [] : lines.map((line) => line.id)));
  };

  const exportSelectedLines = () => {
    if (!selectedLineIds.length) {
      error(t("documents.form.toasts.selectLinesFirst"));
      return;
    }
    const selectedSet = new Set(selectedLineIds);
    const selectedLines = lines.filter((line) => selectedSet.has(line.id));
    const escapeCsvCell = (value: string) => `"${value.replace(/"/g, "\"\"")}"`;
    const rows = [
      ["designation", "unit", "qty", "unit_price", "total"].join(","),
      ...selectedLines.map((line) =>
        [
          line.values.designation || "",
          line.values.unite || "",
          line.values.qte || "0",
          line.values.pu || "0",
          line.values.pt || "0.00",
        ]
          .map(escapeCsvCell)
          .join(","),
      ),
    ];
    const blob = new Blob([`\uFEFF${rows.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${type.toLowerCase()}-lines-${issueDate || "document"}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    success(
      t("documents.form.toasts.selectedLinesExported"),
      t("documents.form.toasts.selectedLinesExportedHint").replace("{count}", String(selectedLines.length)),
    );
  };

  const removeSelectedLines = async () => {
    if (!selectedLineIds.length) {
      error(t("documents.form.toasts.selectLinesFirst"));
      return;
    }
    const shouldDelete = await confirm({
      title: t("documents.form.confirm.deleteSelectedLinesTitle"),
      description: t("documents.form.confirm.deleteSelectedLinesDescription").replace("{count}", String(selectedLineIds.length)),
      confirmLabel: t("documents.form.confirm.deleteSelectedLinesConfirm"),
      cancelLabel: t("documents.form.confirm.deleteSelectedLinesCancel"),
      variant: "danger",
    });
    if (!shouldDelete) {
      return;
    }

    const selectedSet = new Set(selectedLineIds);
    setLines((current) => {
      const next = current.filter((line) => !selectedSet.has(line.id));
      return next.length ? next : [rowFromColumns(columns, {}, defaultUnit)];
    });
    setSelectedLineIds([]);
    success(
      t("documents.form.toasts.linesDeleted"),
      t("documents.form.toasts.linesDeletedHint").replace("{count}", String(selectedLineIds.length)),
    );
  };

  const submitDocument = async () => {
    if (requiresDueDate && !dueDate.trim()) {
      error(t("documents.form.toasts.dueDateRequired"));
      return;
    }
    if (!canCreate) {
      if (!unitPriceReady) {
        error(
          t("documents.form.toasts.unitPriceRequired"),
          t("documents.form.toasts.unitPriceRequiredHint").replace("{count}", String(linesMissingUnitPrice.length)),
        );
        return;
      }
      error(t("documents.form.toasts.incomplete"), t("documents.form.toasts.incompleteHint"));
      return;
    }

    const existingClient = savedClients.find((item) => item.name.trim().toLowerCase() === clientName.trim().toLowerCase());
    let savedClientName = clientName.trim();
    let dbClientId: string | null = null;
    let shouldPersistClient = Boolean(existingClient) || isEditing;

    if (!existingClient) {
      if (!isEditing) {
        shouldPersistClient = await confirm({
          title: t("documents.form.confirm.saveClientTitle"),
          description: t("documents.form.confirm.saveClientDescription"),
          confirmLabel: t("documents.form.confirm.saveClientConfirm"),
          cancelLabel: t("documents.form.confirm.saveClientSkip"),
        });

        if (shouldPersistClient) {
          success(t("documents.form.toasts.clientSaved"), clientName.trim());
        }
      }
    } else {
      savedClientName = existingClient.name;
      dbClientId = existingClient.id;
    }

    if (shouldPersistClient) {
      const dbClientResult = await upsertClientFromDocumentAction({
        name: clientName,
        email: clientEmail,
        phone: clientPhone,
        address: clientAddress,
        ice: clientIce,
        ifNumber: clientIf,
      });
      if (!dbClientResult.ok) {
        error(t("documents.form.toasts.dbClientSaveFailed"), dbClientResult.error);
        return;
      }
      dbClientId = dbClientResult.client.id;
      savedClientName = dbClientResult.client.name;
    }

    const normalizedLines = validLines.map((line) => normalizeLineValues(line.values, defaultUnit));
    persistUnits(normalizedLines.map((line) => line.unite || ""), false);

    const articleKeys = new Set<string>();
    const newArticles = normalizedLines.filter((line) => {
      const designation = (line.designation || "").trim();
      if (!designation) {
        return false;
      }
      const key = designation.toLowerCase();
      if (articleKeys.has(key)) {
        return false;
      }
      articleKeys.add(key);
      return !findArticleInLibrary(designation);
    });

    let shouldPersistArticles = false;
    if (newArticles.length > 0) {
      shouldPersistArticles = await confirm({
        title: t("documents.form.confirm.saveArticlesTitle"),
        description:
          newArticles.length === 1
            ? t("documents.form.confirm.saveArticlesOne")
            : t("documents.form.confirm.saveArticlesMany").replace("{count}", String(newArticles.length)),
        confirmLabel: t("documents.form.confirm.saveArticlesConfirm"),
        cancelLabel: t("documents.form.confirm.saveArticlesSkip"),
      });

      if (shouldPersistArticles) {
        success(t("documents.form.toasts.articlesSaved"), t("documents.form.toasts.articlesSavedHint").replace("{count}", String(newArticles.length)));
      }
    }

    if (shouldPersistArticles) {
      const dbProductKeys = new Set<string>();
      for (const line of newArticles) {
        const designation = (line.designation || "").trim();
        if (!designation) {
          continue;
        }
        const key = designation.toLowerCase();
        if (dbProductKeys.has(key)) {
          continue;
        }
        dbProductKeys.add(key);

        const dbProductResult = await upsertProductFromDocumentAction({
          designation,
          unite: line.unite,
          pu: line.pu,
          tvaRate,
        });
        if (!dbProductResult.ok) {
          error(t("documents.form.toasts.dbArticleSaveFailed"), dbProductResult.error);
          return;
        }
      }

      const refreshedLibraries = await getDocumentFormLibrariesAction();
      if (refreshedLibraries.ok) {
        setSavedClients(refreshedLibraries.clients as ClientLibraryRow[]);
        setSavedArticles(refreshedLibraries.articles);
      }
    }

    const payload = {
      documentType: type,
      issueDate,
      dueDate: requiresDueDate ? dueDate : null,
      client: {
        id: dbClientId || editingClientId,
        name: clientName,
        email: clientEmail,
        phone: clientPhone,
        address: clientAddress,
        ice: clientIce,
        ifNumber: clientIf,
      },
      totals: {
        subtotalHT,
        totalTax,
        totalTTC,
        tvaRate,
      },
      lines: normalizedLines,
    };
    const dbDocumentResult = isEditing && initialDocument
      ? await updateDocumentFromDraftAction({
          ...payload,
          documentId: initialDocument.id,
        })
      : await createDocumentFromDraftAction(payload);

    if (!dbDocumentResult.ok) {
      error(isEditing ? t("documents.form.toasts.dbDocumentUpdateFailed") : t("documents.form.toasts.dbDocumentSaveFailed"), dbDocumentResult.error);
      return;
    }
    const saved = dbDocumentResult.document as DocumentSavedRow;
    emitWorkspaceEvent(STORE_EVENTS.documentsUpdated);
    onDocumentSaved?.(saved);

    if (!isEditing && clientEmail.trim()) {
      const template = emailTemplates[type];
      if (template.enabled && template.autoSendOnCreate) {
        const subject = applyEmailTemplateVariables(template.subject, {
          client_name: savedClientName,
          document_number: saved.number,
          document_type: documentTypeLabel(type),
          total_ttc: `${totalTTC.toFixed(2)} MAD`,
        });
        info(t("documents.form.toasts.autoEmailPrepared"), `${clientEmail.trim()} - ${subject}`);
      }
    }

    success(
      isEditing ? t("documents.form.toasts.documentUpdated") : t("documents.form.toasts.documentSaved"),
      t("documents.form.toasts.documentSavedHint").replace("{type}", documentTypeLabel(type)).replace("{client}", savedClientName),
    );
    closeModal();
  };

  return (
    <>
      {!hideTrigger ? (
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition hover:border-primary hover:text-primary-foreground"
        >
          <HugIcon icon={CirclePlus} size={16} />
          {t("documents.form.newDocument")}
        </button>
      ) : null}
      {isOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-3 sm:p-4">
          <div className="flex min-h-0 max-h-[80vh] w-full max-w-7xl flex-col overflow-hidden rounded-xl border border-border bg-card p-3 shadow-2xl shadow-black/50 sm:p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">{t("documents.form.documentTag")}</p>
                <h2 className="text-lg font-semibold text-foreground">{isEditing ? t("documents.form.editTitle") : t("documents.form.createTitle")}</h2>
              </div>
              <UiButton type="button" variant="ghost" size="xs" onClick={closeModal} iconOnly iconName="close" />
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2 rounded-lg border border-border bg-background/40 p-1.5 text-xs">
              <button
                type="button"
                onClick={() => setStep("type")}
                className={
                  step === "type"
                    ? "rounded-md bg-primary/20 px-2 py-2 font-semibold text-primary"
                    : "rounded-md px-2 py-2 text-muted-foreground transition hover:text-foreground"
                }
              >
                {t("documents.form.step1")}
              </button>
              <button
                type="button"
                disabled={!type}
                onClick={() => setStep("client")}
                className={
                  step === "client"
                    ? "rounded-md bg-primary/20 px-2 py-2 font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-50"
                    : "rounded-md px-2 py-2 text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                }
              >
                {t("documents.form.step2")}
              </button>
              <button
                type="button"
                disabled={!requiredClientReady || !dueDateReady}
                onClick={() => setStep("articles")}
                className={
                  step === "articles"
                    ? "rounded-md bg-primary/20 px-2 py-2 font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-50"
                    : "rounded-md px-2 py-2 text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                }
              >
                {t("documents.form.step3")}
              </button>
            </div>

            <div className="min-h-0 flex flex-1 flex-col overflow-hidden">
              <div className="min-h-0 overflow-y-auto pr-1 sm:pr-2">
                {step === "type" ? (
                  <div className="h-full space-y-3 overflow-y-auto pr-1 sm:pr-2">
                    <p className="text-xs text-muted-foreground">{t("documents.form.typeHint")}</p>
                    <div className={` grid items-center justify-center gap-3 md:grid-cols-4`}>
                      {enabledTypes.map((documentType) => (
                        <button
                          key={documentType}
                          type="button"
                          onClick={() => updateType(documentType)}
                          className={
                            type === documentType
                              ? "flex flex-col items-center gap-3 rounded-md border border-primary/40 bg-primary/10 px-3 py-3 text-left text-sm font-semibold text-primary"
                              : "flex flex-col items-center gap-3 rounded-md border border-border bg-background/40 px-3 py-3 text-left text-sm font-semibold text-muted-foreground transition hover:text-foreground"
                          }
                        >
                          <HugIcon icon={documentTypeIcons[documentType]} size={18} />
                          <span>{documentTypeLabel(documentType)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {step === "client" ? (
                  <div className="grid h-full gap-4 overflow-y-auto pr-1 md:grid-cols-3 sm:pr-2">
                    <div className="rounded-md border border-border bg-background/30 p-3 text-xs text-muted-foreground">
                      {t("documents.form.selectedType")}
                      <p className="mt-1 text-sm font-semibold text-foreground">{documentTypeLabel(type)}</p>
                    </div>
                    <FormField
                      type="date"
                      label={t("documents.form.issueDate")}
                      value={issueDate}
                      onChange={onIssueDateChange}
                    />
                    {requiresDueDate ? (
                      <FormField
                        type="date"
                        label={t("documents.form.dueDate")}
                        required
                        value={dueDate}
                        min={issueDate}
                        onChange={onDueDateChange}
                      />
                    ) : (
                      <div />
                    )}
                    <FormField
                      type="text"
                      label={t("documents.form.clientName")}
                      required
                      value={clientName}
                      onChange={onClientNameChange}
                      onBlur={syncClientFromLibrary}
                      list="saved-clients-list"
                      placeholder={t("documents.form.clientNamePlaceholder")}
                      className="md:col-span-2"
                    />
                    <datalist id="saved-clients-list">
                      {savedClients.map((client) => (
                        <option key={client.id} value={client.name} />
                      ))}
                    </datalist>

                    <FormField type="email" label={t("documents.form.clientEmail")} value={clientEmail} onChange={setClientEmail} placeholder={t("documents.form.clientEmailPlaceholder")} />
                    <FormField type="text" label={t("documents.form.clientPhone")} required value={clientPhone} onChange={setClientPhone} placeholder={t("documents.form.clientPhonePlaceholder")} />
                    <FormField type="text" label={t("documents.form.clientIce")} value={clientIce} onChange={setClientIce} placeholder={t("documents.form.clientIcePlaceholder")} />

                    <FormField type="text" label={t("documents.form.clientIf")} value={clientIf} onChange={setClientIf} placeholder={t("documents.form.clientIfPlaceholder")} />
                    <FormField
                      type="text"
                      label={t("documents.form.clientAddress")}
                      required
                      value={clientAddress}
                      onChange={setClientAddress}
                      placeholder={t("documents.form.clientAddressPlaceholder")}
                      className="md:col-span-2"
                    />
                  </div>
                ) : null}

                {step === "articles" ? (
                  <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
                    <section className="flex min-h-0 flex-col rounded-xl border border-border bg-card/70 p-3">
                      <div className="mb-3 flex items-center justify-between rounded-lg border border-border/70 bg-background/30 px-3 py-2">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("documents.form.step3")}</p>
                          <p className="text-xs text-muted-foreground">{t("documents.form.footerHint")}</p>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <span className="text-[11px] text-muted-foreground">
                            {t("documents.form.selectedCount").replace("{count}", String(selectedLinesCount))}
                          </span>
                          <UiButton type="button" size="xs" variant="ghost" onClick={toggleSelectAllLines}>
                            {allLinesSelected ? t("documents.form.clearSelection") : t("documents.form.selectAll")}
                          </UiButton>
                          <UiButton type="button" size="xs" variant="outline" icon="export" disabled={!selectedLinesCount} onClick={exportSelectedLines}>
                            {t("documents.form.exportSelected")}
                          </UiButton>
                          <UiButton type="button" size="xs" variant="danger" icon="remove" disabled={!selectedLinesCount} onClick={removeSelectedLines}>
                            {t("documents.form.deleteSelected")}
                          </UiButton>
                          <UiButton type="button" size="sm" variant="outline" icon="plus" onClick={() => addLine()} />
                        </div>
                      </div>

                      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                        {lines.map((line, index) => {
                          const isSelected = selectedLineIds.includes(line.id);
                          return (
                          <div
                            key={line.id}
                            className={
                              isSelected
                                ? "rounded-lg border border-primary/50 bg-primary/5 p-2.5"
                                : "rounded-lg border border-border bg-background/35 p-2.5"
                            }
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background/60 px-2 py-1 text-[11px] text-muted-foreground">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleLineSelection(line.id)}
                                    className="h-3.5 w-3.5 accent-primary"
                                  />
                                  <span>{t("documents.form.select")}</span>
                                </label>
                                <p className="shrink-0 rounded-md border border-border bg-background/70 px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                                  #{String(index + 1).padStart(2, "0")}
                                </p>
                              </div>
                              <UiButton type="button" size="xs" variant="danger" iconOnly icon="remove" onClick={() => removeLine(line.id)} />
                            </div>

                              <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                                {orderedLineColumns.map((column) => (
                                  <div key={column.id}>
                                    {renderLineField(line, column)}
                                  </div>
                                ))}
                              </div>
                          </div>
                        )})}
                      </div>

                      <datalist id="saved-articles-list">
                        {savedArticles.map((article) => (
                          <option key={article.id} value={article.designation} />
                        ))}
                      </datalist>
                      <datalist id="saved-units-list">
                        {baseUnitOptions.map((option) => (
                          <option key={option.value} value={option.value} />
                        ))}
                      </datalist>

                      <div className="mt-3 ml-auto w-full rounded-lg border border-border bg-background/40 p-3 text-xs md:max-w-md">
                        <div className="flex items-center justify-between py-1">
                          <span className="text-muted-foreground">{t("documents.form.subtotalHT")}</span>
                          <span className="font-semibold text-foreground">{subtotalHT.toFixed(2)} MAD</span>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-muted-foreground">{t("documents.form.tva").replace("{rate}", tvaRate.toFixed(2))}</span>
                          <span className="font-semibold text-foreground">{totalTax.toFixed(2)} MAD</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between border-t border-border pt-2">
                          <span className="text-muted-foreground">{t("documents.form.totalTTC")}</span>
                          <span className="text-sm font-semibold text-primary">{totalTTC.toFixed(2)} MAD</span>
                        </div>
                      </div>
                    </section>

                    <aside className="flex min-h-0 flex-col rounded-xl border border-border bg-background/20 p-3">
                      <p className="mb-2 text-xs text-muted-foreground">{t("documents.form.posPicker")}</p>
                      <FormField
                        type="text"
                        value={articleQuery}
                        onChange={setArticleQuery}
                        placeholder={t("documents.form.searchArticles")}
                      />
                      <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                        {suggestedArticles.map((article) => (
                          <button
                            key={article.id}
                            type="button"
                            onClick={() => addLineFromArticle(article)}
                            className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-left text-xs text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
                            title={article.designation}
                          >
                            <p className="line-clamp-2 break-words text-[12px] font-semibold leading-snug text-foreground">{article.designation}</p>
                            <p className="mt-1 break-words leading-snug">
                              {t("documents.form.articleHint").replace("{pu}", article.values.pu || "0.00").replace("{unit}", article.values.unite || defaultUnit)}
                            </p>
                          </button>
                        ))}
                        {suggestedArticles.length === 0 ? (
                          <p className="rounded-lg border border-border bg-background/50 px-3 py-2 text-xs text-muted-foreground">{t("documents.form.noArticleMatch")}</p>
                        ) : null}
                      </div>
                    </aside>
                  </div>
                ) : null}
              </div>
            </div>
            

            <div className="mt-5 flex flex-col gap-2 rounded-md border border-border bg-background/30 px-3 py-2 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0">
                {t("documents.form.footerHint")}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {step === "client" ? (
                  <UiButton type="button" size="sm" variant="ghost" onClick={() => setStep("type")}>
                    {t("documents.form.back")}
                  </UiButton>
                ) : null}
                {step === "articles" ? (
                  <UiButton type="button" size="sm" variant="ghost" onClick={() => setStep("client")}>
                    {t("documents.form.back")}
                  </UiButton>
                ) : null}
                {step === "type" ? (
                  <UiButton type="button" size="sm" variant="primary" onClick={() => setStep("client")}>
                    {t("documents.form.nextClient")}
                  </UiButton>
                ) : null}
                {step === "client" ? (
                  <UiButton type="button" disabled={!requiredClientReady || !dueDateReady} size="sm" variant="primary" onClick={() => setStep("articles")}>
                    {t("documents.form.nextArticles")}
                  </UiButton>
                ) : null}
                {step === "articles" ? (
                  <UiButton type="button" disabled={!canCreate} size="sm" variant="primary" onClick={submitDocument}>
                    {isEditing ? t("documents.form.updateDocument") : t("documents.form.saveDocument")}
                  </UiButton>
                ) : null}
              </div>
            </div>

          </div>
        </div>
      ) : null}
    </>
  );
}
