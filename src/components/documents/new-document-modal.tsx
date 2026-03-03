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
  getEmailTemplateSettings,
  DocumentType,
  getDefaultTvaRate,
  listDocumentUnits,
  saveDocumentUnits,
  listArticles,
  listClients,
  listEnabledDocumentTypes,
  listTemplateColumns,
  STORE_EVENTS,
  StoredArticle,
  DOCUMENT_TYPE_OPTIONS,
  TemplateLineColumn,
  upsertArticle,
  upsertClient,
} from "@/features/documents/lib/workspace-store";
import {
  createDocumentFromDraftAction,
  updateDocumentFromDraftAction,
  upsertClientFromDocumentAction,
  upsertProductFromDocumentAction,
} from "@/features/documents/actions";
import { useI18n } from "@/i18n/provider";

type WizardStep = "type" | "client" | "articles";
type LineDraft = {
  id: string;
  values: Record<string, string>;
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
  const [enabledTypes, setEnabledTypes] = useState<DocumentType[]>(() => listEnabledDocumentTypes());
  const [type, setType] = useState<DocumentType>(() => getDefaultType(listEnabledDocumentTypes()));
  const [tvaRate, setTvaRate] = useState<number>(() => getDefaultTvaRate());
  const [issueDate, setIssueDate] = useState<string>(() => toDateInputValue(new Date()));
  const [dueDate, setDueDate] = useState<string>("");
  const [dueDateTouched, setDueDateTouched] = useState(false);

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientIce, setClientIce] = useState("");
  const [clientIf, setClientIf] = useState("");

  const [units, setUnits] = useState<string[]>(() => listDocumentUnits());
  const [defaultUnit, setDefaultUnit] = useState(() => resolveDefaultUnit(listDocumentUnits()));
  const [columns, setColumns] = useState<TemplateLineColumn[]>(() => listTemplateColumns(type).filter((column) => column.enabled));
  const [lines, setLines] = useState<LineDraft[]>(() => [
    rowFromColumns(listTemplateColumns(type).filter((column) => column.enabled), {}, resolveDefaultUnit(listDocumentUnits())),
  ]);
  const [savedClients, setSavedClients] = useState(() => listClients());
  const [savedArticles, setSavedArticles] = useState(() => listArticles());
  const [articleQuery, setArticleQuery] = useState("");
  const [editingClientId, setEditingClientId] = useState<string | null>(null);

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
  const documentTypeLabel = (documentType: DocumentType) => t(DOCUMENT_TYPE_I18N_KEYS[documentType] || "documents.types.devis");

  const setOpenState = (next: boolean) => {
    if (!isControlled) {
      setLocalOpen(next);
    }
    onOpenChange?.(next);
  };

  useEffect(() => {
    const syncConfig = () => {
      const nextEnabledTypes = listEnabledDocumentTypes();
      const nextType = nextEnabledTypes.includes(type) ? type : getDefaultType(nextEnabledTypes);
      const nextColumns = listTemplateColumns(nextType).filter((column) => column.enabled);
      const nextUnits = listDocumentUnits();
      const nextDefaultUnit = resolveDefaultUnit(nextUnits);

      setEnabledTypes(nextEnabledTypes);
      setType(nextType);
      setTvaRate(getDefaultTvaRate());
      setUnits(nextUnits);
      setDefaultUnit(nextDefaultUnit);
      setColumns(nextColumns);
      setLines((current) => {
        if (current.length === 0) {
          return [rowFromColumns(nextColumns, {}, nextDefaultUnit)];
        }
        return current.map((line) => rowFromColumns(nextColumns, line.values, nextDefaultUnit));
      });
    };

    const syncLibraries = () => {
      setSavedClients(listClients());
      setSavedArticles(listArticles());
    };
    const syncUnits = () => {
      const nextUnits = listDocumentUnits();
      const nextDefaultUnit = resolveDefaultUnit(nextUnits);
      setUnits(nextUnits);
      setDefaultUnit(nextDefaultUnit);
      setLines((current) => current.map((line) => ({ ...line, values: normalizeLineValues(line.values, nextDefaultUnit) })));
    };

    window.addEventListener(STORE_EVENTS.businessConfigUpdated, syncConfig);
    window.addEventListener(STORE_EVENTS.clientsUpdated, syncLibraries);
    window.addEventListener(STORE_EVENTS.articlesUpdated, syncLibraries);
    window.addEventListener(STORE_EVENTS.unitsUpdated, syncUnits);
    return () => {
      window.removeEventListener(STORE_EVENTS.businessConfigUpdated, syncConfig);
      window.removeEventListener(STORE_EVENTS.clientsUpdated, syncLibraries);
      window.removeEventListener(STORE_EVENTS.articlesUpdated, syncLibraries);
      window.removeEventListener(STORE_EVENTS.unitsUpdated, syncUnits);
    };
  }, [type]);

  useEffect(() => {
    if (!isOpen || !initialDocument) {
      return;
    }

    const nextColumns = listTemplateColumns(initialDocument.type).filter((column) => column.enabled);
    const nextUnits = listDocumentUnits();
    const nextDefaultUnit = resolveDefaultUnit(nextUnits);
    const mappedLines = initialDocument.lines.length
      ? initialDocument.lines.map((line) => rowFromColumns(nextColumns, line, nextDefaultUnit))
      : [rowFromColumns(nextColumns, {}, nextDefaultUnit)];

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnabledTypes(listEnabledDocumentTypes());
    setType(initialDocument.type);
    setTvaRate(initialDocument.tvaRate);
    setIssueDate((initialDocument.issueDate || new Date().toISOString()).slice(0, 10));
    setDueDate((initialDocument.dueDate || "").slice(0, 10));
    setDueDateTouched(Boolean(initialDocument.dueDate));
    setUnits(nextUnits);
    setDefaultUnit(nextDefaultUnit);
    setColumns(nextColumns);
    setLines(mappedLines);
    setClientName(initialDocument.client.name || "");
    setClientEmail(initialDocument.client.email || "");
    setClientPhone(initialDocument.client.phone || "");
    setClientAddress(initialDocument.client.address || "");
    setClientIce(initialDocument.client.ice || "");
    setClientIf(initialDocument.client.ifNumber || "");
    setEditingClientId(initialDocument.client.id || null);
    setSavedClients(listClients());
    setSavedArticles(listArticles());
    setArticleQuery("");
    setStep("client");
  }, [initialDocument, isOpen]);

  const resetWizard = (nextType: DocumentType) => {
    const nextColumns = listTemplateColumns(nextType).filter((column) => column.enabled);
    const nextUnits = listDocumentUnits();
    const nextDefaultUnit = resolveDefaultUnit(nextUnits);
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
    setUnits(nextUnits);
    setDefaultUnit(nextDefaultUnit);
    setColumns(nextColumns);
    setLines([rowFromColumns(nextColumns, {}, nextDefaultUnit)]);
    setArticleQuery("");
  };

  const openModal = () => {
    const nextEnabledTypes = listEnabledDocumentTypes();
    const nextType = nextEnabledTypes.includes(type) ? type : getDefaultType(nextEnabledTypes);
    const nextColumns = listTemplateColumns(nextType).filter((column) => column.enabled);
    const nextUnits = listDocumentUnits();
    const nextDefaultUnit = resolveDefaultUnit(nextUnits);
    const today = toDateInputValue(new Date());

    setEnabledTypes(nextEnabledTypes);
    setType(nextType);
    setTvaRate(getDefaultTvaRate());
    setIssueDate(today);
    setDueDate(nextType === "FACTURE" ? addDaysToDateInput(today, 30) : "");
    setDueDateTouched(false);
    setUnits(nextUnits);
    setDefaultUnit(nextDefaultUnit);
    setColumns(nextColumns);
    setLines([rowFromColumns(nextColumns, {}, nextDefaultUnit)]);
    setSavedClients(listClients());
    setSavedArticles(listArticles());
    setArticleQuery("");
    setEditingClientId(null);
    setStep("type");
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
    const nextColumns = listTemplateColumns(nextType).filter((column) => column.enabled);
    const nextDefaultUnit = resolveDefaultUnit(units);
    setColumns(nextColumns);
    setLines((current) => {
      const mapped = current.map((line) => rowFromColumns(nextColumns, line.values, nextDefaultUnit));
      return mapped.length ? mapped : [rowFromColumns(nextColumns, {}, nextDefaultUnit)];
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
    saveDocumentUnits(nextUnits);
    setUnits(nextUnits);
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
            designation: hit.designation,
          }, defaultUnit),
        };
      }),
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

    if (!existingClient) {
      if (!isEditing) {
        const shouldSaveClient = await confirm({
          title: t("documents.form.confirm.saveClientTitle"),
          description: t("documents.form.confirm.saveClientDescription"),
          confirmLabel: t("documents.form.confirm.saveClientConfirm"),
          cancelLabel: t("documents.form.confirm.saveClientSkip"),
        });

        if (shouldSaveClient) {
          const savedClient = upsertClient({
            name: clientName,
            email: clientEmail,
            phone: clientPhone,
            address: clientAddress,
            ice: clientIce,
            ifNumber: clientIf,
          });
          if (savedClient) {
            savedClientName = savedClient.name;
            success(t("documents.form.toasts.clientSaved"), savedClient.name);
          }

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
        }
      }
    } else {
      savedClientName = existingClient.name;
      dbClientId = existingClient.id;
    }

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

    if (newArticles.length > 0) {
      const shouldSaveArticles = await confirm({
        title: t("documents.form.confirm.saveArticlesTitle"),
        description:
          newArticles.length === 1
            ? t("documents.form.confirm.saveArticlesOne")
            : t("documents.form.confirm.saveArticlesMany").replace("{count}", String(newArticles.length)),
        confirmLabel: t("documents.form.confirm.saveArticlesConfirm"),
        cancelLabel: t("documents.form.confirm.saveArticlesSkip"),
      });

      if (shouldSaveArticles) {
        for (const line of newArticles) {
          upsertArticle(line);
        }
        success(t("documents.form.toasts.articlesSaved"), t("documents.form.toasts.articlesSavedHint").replace("{count}", String(newArticles.length)));
        setSavedArticles(listArticles());
      }
    }

    const dbProductKeys = new Set<string>();
    for (const line of normalizedLines) {
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
      const template = getEmailTemplateSettings()[type];
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-7xl rounded-md border border-border bg-card/95 p-5 shadow-2xl shadow-black/50">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">{t("documents.form.documentTag")}</p>
                <h2 className="text-lg font-semibold text-foreground">{isEditing ? t("documents.form.editTitle") : t("documents.form.createTitle")}</h2>
              </div>
              <UiButton type="button" variant="ghost" size="xs" onClick={closeModal} iconOnly iconName="close" />
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2 rounded-md border border-border bg-background/30 p-2 text-xs">
              <button
                type="button"
                onClick={() => setStep("type")}
                className={step === "type" ? "rounded-sm bg-primary/20 px-2 py-2 text-primary" : "rounded-sm px-2 py-2 text-muted-foreground"}
              >
                {t("documents.form.step1")}
              </button>
              <button
                type="button"
                disabled={!type}
                onClick={() => setStep("client")}
                className={
                  step === "client"
                    ? "rounded-sm bg-primary/20 px-2 py-2 text-primary disabled:cursor-not-allowed disabled:opacity-50"
                    : "rounded-sm px-2 py-2 text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
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
                    ? "rounded-sm bg-primary/20 px-2 py-2 text-primary disabled:cursor-not-allowed disabled:opacity-50"
                    : "rounded-sm px-2 py-2 text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                }
              >
                {t("documents.form.step3")}
              </button>
            </div>

            {step === "type" ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">{t("documents.form.typeHint")}</p>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
              <div className="grid gap-4 md:grid-cols-3">
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
              <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
                <aside className="space-y-3 rounded-md border border-border bg-background/20 p-3">
                  <p className="text-xs text-muted-foreground">{t("documents.form.posPicker")}</p>
                  <FormField
                    type="text"
                    value={articleQuery}
                    onChange={setArticleQuery}
                    placeholder={t("documents.form.searchArticles")}
                  />
                  <div className="max-h-[350px] space-y-2 overflow-y-auto pr-1">
                    {suggestedArticles.map((article) => (
                      <button
                        key={article.id}
                        type="button"
                        onClick={() => addLineFromArticle(article)}
                        className="w-full rounded-md border border-border bg-background/50 px-3 py-2 text-left text-xs text-muted-foreground transition hover:text-foreground"
                      >
                        <p className="font-semibold text-foreground">{article.designation}</p>
                        <p>{t("documents.form.articleHint").replace("{pu}", article.values.pu || "0.00").replace("{unit}", article.values.unite || defaultUnit)}</p>
                      </button>
                    ))}
                    {suggestedArticles.length === 0 ? (
                      <p className="rounded-md border border-border bg-background/50 px-3 py-2 text-xs text-muted-foreground">{t("documents.form.noArticleMatch")}</p>
                    ) : null}
                  </div>
                  <UiButton type="button" size="sm" variant="outline" icon="plus" onClick={() => addLine()}/>
                </aside>

                <section className="space-y-3 rounded-md border border-border bg-card/70 p-3">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-xs">
                      <thead>
                        <tr className="grid items-center gap-3 grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
                          <th className="py-2 text-start text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                            {t("documents.form.designation")}
                          </th>
                          <th className="py-2 text-start text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                            {t("documents.details.unit")}
                          </th>
                          <th className="py-2 text-start text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                            {t("documents.details.qty")}
                          </th>
                          <th className="py-2 text-start text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                            {t("documents.details.unitPriceHT")}
                          </th>
                          <th className="py-2 text-start text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                            {t("documents.details.totalHT")}
                          </th>
                          <th className="py-2 text-end text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                            {t("common.delete")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {lines.map((line) => (
                          <tr key={line.id} className="grid items-center gap-3 grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
                            <td className=" py-2">
                              <FormField
                                type="text"
                                value={line.values.designation || ""}
                                list="saved-articles-list"
                                onBlur={(value) => tryAutoFillArticle(line.id, value)}
                                onChange={(value) => {
                                  updateLine(line.id, "designation", value);
                                  tryAutoFillArticle(line.id, value);
                                }}
                                placeholder={t("documents.form.designation")}
                              />
                            </td>
                            <td className=" py-2">
                              <FormField
                                type="text"
                                value={line.values.unite || defaultUnit}
                                list="saved-units-list"
                                placeholder={t("documents.form.unitPlaceholder")}
                                onChange={(value) => updateLine(line.id, "unite", value)}
                                onBlur={(value) => {
                                  const normalized = normalizeUnitInput(value) || defaultUnit;
                                  updateLine(line.id, "unite", normalized);
                                  persistUnits([normalized], true);
                                }}
                              />
                            </td>
                            <td className=" py-2">
                              <FormField
                                type="number"
                                value={line.values.qte || "1"}
                                onChange={(value) => updateLine(line.id, "qte", value)}
                                min="0"
                                step="0.001"
                              />
                            </td>
                            <td className=" py-2">
                              <FormField
                                type="number"
                                value={line.values.pu || "0"}
                                onChange={(value) => updateLine(line.id, "pu", value)}
                                min="0"
                                step="0.01"
                              />
                            </td>
                            <td className=" py-2">
                              <FormField type="number" value={line.values.pt || "0.00"} readOnly inputClassName="bg-background/40" />
                            </td>
                            <td className=" py-2 text-right">
                              <UiButton type="button" size="sm" variant="danger" icon="remove" onClick={() => removeLine(line.id)}/>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
                  </div>

                  <div className="ml-auto w-full rounded-md border border-border bg-background/30 p-3 text-xs md:max-w-sm">
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
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-between rounded-md border border-border bg-background/30 px-3 py-2 text-[11px] text-muted-foreground">
              <span>
                {t("documents.form.footerHint")}
              </span>
              <div className="flex items-center gap-2">
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
