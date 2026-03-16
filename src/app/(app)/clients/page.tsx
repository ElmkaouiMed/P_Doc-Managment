import { prisma } from "@/lib/db";
import { requireAuthContext } from "@/features/auth/lib/session";
import { ClientsView } from "@/features/clients/components/clients-view";
import { getServerI18n } from "@/i18n/server";

export default async function ClientsPage() {
  const auth = await requireAuthContext();
  const { t } = await getServerI18n();
  const companyId = auth.company.id;
  const [clients, documentAgg, overdueAgg, latestDocument] = await Promise.all([
    prisma.client.findMany({
      where: { companyId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        code: true,
        name: true,
        email: true,
        phone: true,
        phoneFix: true,
        address: true,
        city: true,
        country: true,
        ice: true,
        ifNumber: true,
        notes: true,
        updatedAt: true,
      },
    }),
    prisma.document.groupBy({
      where: {
        companyId,
        clientId: { not: null },
      },
      by: ["clientId"],
      _count: { _all: true },
      _sum: {
        totalTTC: true,
        amountDue: true,
        amountPaid: true,
      },
      _max: {
        issueDate: true,
        createdAt: true,
      },
    }),
    prisma.document.groupBy({
      where: {
        companyId,
        clientId: { not: null },
        status: "OVERDUE",
      },
      by: ["clientId"],
      _count: { _all: true },
    }),
    prisma.document.findFirst({
      where: { companyId },
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
      select: { currency: true },
    }),
  ]);
  const currency = latestDocument?.currency || "MAD";

  const docByClient = new Map(
    documentAgg
      .filter((row) => row.clientId)
      .map((row) => [
        row.clientId as string,
        {
          documentsCount: row._count._all,
          totalBilled: Number(row._sum.totalTTC || 0),
          totalDue: Number(row._sum.amountDue || 0),
          totalPaid: Number(row._sum.amountPaid || 0),
          lastDocumentAt: (row._max.issueDate || row._max.createdAt)?.toISOString() || null,
        },
      ]),
  );
  const overdueByClient = new Map(
    overdueAgg
      .filter((row) => row.clientId)
      .map((row) => [row.clientId as string, row._count._all]),
  );

  const rows = clients.map((client) => ({
    ...client,
    documentsCount: docByClient.get(client.id)?.documentsCount || 0,
    totalBilled: docByClient.get(client.id)?.totalBilled || 0,
    totalDue: docByClient.get(client.id)?.totalDue || 0,
    totalPaid: docByClient.get(client.id)?.totalPaid || 0,
    overdueDocuments: overdueByClient.get(client.id) || 0,
    lastDocumentAt: docByClient.get(client.id)?.lastDocumentAt || null,
    updatedAt: client.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("clients.page.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("clients.page.subtitle")}
        </p>
      </header>
      <ClientsView clients={rows} currency={currency} />
    </div>
  );
}
