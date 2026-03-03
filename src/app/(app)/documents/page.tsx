import { DocumentType } from "@prisma/client";

import { NewDocumentModal } from "@/components/documents/new-document-modal";
import { StatCard } from "@/components/common/stat-card";
import { UiButton } from "@/components/ui/ui-button";
import { DocumentsTable } from "@/features/documents/components/documents-table";
import { ExtractImportPanel } from "@/features/documents/components/extract-import-panel";
import { requireAuthContext } from "@/features/auth/lib/session";
import { getServerI18n } from "@/i18n/server";
import { prisma } from "@/lib/db";

function formatMoney(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(2)} MAD`;
}

function isOverdueStatusCandidate(status: string) {
  return status === "DRAFT" || status === "ISSUED" || status === "SENT";
}

export default async function DocumentsPage() {
  const auth = await requireAuthContext();
  const { t } = await getServerI18n();
  const documents = await prisma.document.findMany({
    where: { companyId: auth.company.id },
    orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      documentNumber: true,
      documentType: true,
      status: true,
      totalTTC: true,
      issueDate: true,
      dueDate: true,
      createdAt: true,
      metadataJson: true,
      client: {
        select: {
          name: true,
        },
      },
    },
  });

  const rows = documents.map((doc) => {
    const metadata = typeof doc.metadataJson === "object" && doc.metadataJson !== null && !Array.isArray(doc.metadataJson) ? doc.metadataJson : null;
    const snapshot =
      metadata && typeof metadata.clientSnapshot === "object" && metadata.clientSnapshot !== null && !Array.isArray(metadata.clientSnapshot)
        ? (metadata.clientSnapshot as Record<string, unknown>)
        : null;
    const snapshotName = typeof snapshot?.name === "string" ? snapshot.name : null;

    const isOverdue = Boolean(doc.dueDate) && isOverdueStatusCandidate(doc.status) && (doc.dueDate as Date) < new Date();

    return {
      id: doc.id,
      number: doc.documentNumber,
      type: doc.documentType,
      client: doc.client?.name || snapshotName || t("documents.clientFallback"),
      status: isOverdue ? "OVERDUE" : doc.status,
      total: formatMoney(Number(doc.totalTTC)),
      issueDate: (doc.issueDate || doc.createdAt).toISOString(),
    };
  });

  const totalDocuments = rows.length;
  const totalAmountTTC = documents.reduce((sum, doc) => {
    if (doc.documentType !== DocumentType.FACTURE) {
      return sum;
    }
    return sum + Number(doc.totalTTC);
  }, 0);
  const overdueDocuments = rows.filter((row) => row.status === "OVERDUE").length;
  const draftDocuments = rows.filter((row) => row.status === "DRAFT").length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("documents.page.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("documents.page.subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <NewDocumentModal />
          <ExtractImportPanel />
          <UiButton size="sm" variant="subtle" iconName="export" label={t("documents.page.exportList")} />
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("documents.page.summary.totalDocuments")}
          value={String(totalDocuments)}
          hint={t("documents.page.summary.totalDocumentsHint")}
        />
        <StatCard
          label={t("documents.page.summary.totalAmount")}
          value={formatMoney(totalAmountTTC)}
          hint={t("documents.page.summary.totalAmountHint")}
        />
        <StatCard
          label={t("documents.page.summary.overdue")}
          value={String(overdueDocuments)}
          hint={t("documents.page.summary.overdueHint")}
        />
        <StatCard
          label={t("documents.page.summary.draft")}
          value={String(draftDocuments)}
          hint={t("documents.page.summary.draftHint")}
        />
      </section>

      <DocumentsTable initialRows={rows} />
    </div>
  );
}
