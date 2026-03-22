import { DocumentType } from "@/lib/db-client";

import { NewDocumentModal } from "@/components/documents/new-document-modal";
import { StatCard } from "@/components/common/stat-card";
import { PageEducationBanner } from "@/components/marketing/page-education-banner";
import { DocumentsTable } from "@/features/documents/components/documents-table";
import { ExportDocumentsListButton } from "@/features/documents/components/export-documents-list-button";
import { ExtractImportPanel } from "@/features/documents/components/extract-import-panel";
import { requireAuthContext } from "@/features/auth/lib/session";
import { hasCompanyAccess } from "@/features/billing/lib/account-lifecycle";
import { getServerI18n } from "@/i18n/server";
import { prisma } from "@/lib/db";

function formatMoney(value: number, currency = "MAD") {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(2)} ${currency}`;
}

function isOverdueStatusCandidate(status: string) {
  return status === "DRAFT" || status === "ISSUED" || status === "SENT";
}

export default async function DocumentsPage() {
  const auth = await requireAuthContext();
  const canAuthor = hasCompanyAccess(auth.company.accountStatus, "author");
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
      currency: true,
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
      total: formatMoney(Number(doc.totalTTC), doc.currency || "MAD"),
      issueDate: (doc.issueDate || doc.createdAt).toISOString(),
    };
  });
  const summaryCurrency = documents.find((doc) => typeof doc.currency === "string" && doc.currency.trim().length > 0)?.currency || "MAD";

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
          <p className="text-xs font-light text-muted-foreground">
            {t("documents.page.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAuthor ? <NewDocumentModal /> : null}
          {canAuthor ? <ExtractImportPanel /> : null}
          <ExportDocumentsListButton rows={rows} label={t("documents.page.exportList")} disabled={!canAuthor} />
        </div>
      </header>

      <PageEducationBanner
        title={t("education.banner.documents.title")}
        description={t("education.banner.documents.description")}
        videoLabel={t("education.banner.common.watchVideo")}
        videoHref="https://www.youtube.com/watch?v=aqz-KE-bpKQ"
        helpLabel={t("education.banner.common.needHelp")}
        supportTitle={t("education.banner.support.title")}
        supportDescription={t("education.banner.support.description")}
        supportCallLabel={t("education.banner.support.call")}
        supportCloseLabel={t("education.banner.support.close")}
        sourceSection="education-documents"
        checklist={[
          t("education.banner.documents.point1"),
          t("education.banner.documents.point2"),
          t("education.banner.documents.point3"),
        ]}
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("documents.page.summary.totalDocuments")}
          value={String(totalDocuments)}
          hint={t("documents.page.summary.totalDocumentsHint")}
          metaTone="positive"
        />
        <StatCard
          label={t("documents.page.summary.totalAmount")}
          amount={totalAmountTTC}
          currency={summaryCurrency}
          hint={t("documents.page.summary.totalAmountHint")}
          metaTone="positive"
        />
        <StatCard
          label={t("documents.page.summary.overdue")}
          value={String(overdueDocuments)}
          hint={t("documents.page.summary.overdueHint")}
          metaTone="negative"
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
