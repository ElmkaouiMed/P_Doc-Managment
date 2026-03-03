import { StatCard } from "@/components/common/stat-card";
import { prisma } from "@/lib/db";
import { requireAuthContext } from "@/features/auth/lib/session";
import { AppLocale } from "@/i18n/messages";
import { getServerI18n } from "@/i18n/server";

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return `${value.toFixed(2)} MAD`;
}

function formatDate(date: Date | null | undefined) {
  if (!date) {
    return "-";
  }
  return date.toISOString().slice(0, 10);
}

function monthLabel(date: Date, locale: AppLocale) {
  const intlLocale = locale === "ar" ? "ar-MA" : locale === "en" ? "en-US" : "fr-MA";
  return new Intl.DateTimeFormat(intlLocale, { month: "short" }).format(date);
}

const PAID_STATUSES = new Set(["PAID"]);
const CLOSED_STATUSES = new Set(["PAID", "CANCELLED"]);
const TYPE_KEY_BY_VALUE: Record<string, string> = {
  DEVIS: "documents.types.devis",
  FACTURE: "documents.types.facture",
  FACTURE_PROFORMA: "documents.types.factureProforma",
  BON_LIVRAISON: "documents.types.bonLivraison",
  BON_COMMANDE: "documents.types.bonCommande",
  EXTRACT_DEVIS: "documents.types.extractDevis",
  EXTRACT_BON_COMMANDE_PUBLIC: "documents.types.extractBonCommandePublic",
};
const STATUS_KEY_BY_VALUE: Record<string, string> = {
  DRAFT: "documents.status.draft",
  ISSUED: "documents.status.issued",
  SENT: "documents.status.sent",
  PAID: "documents.status.paid",
  OVERDUE: "documents.status.overdue",
  CANCELLED: "documents.status.cancelled",
};

export default async function DashboardPage() {
  const auth = await requireAuthContext();
  const { locale, t } = await getServerI18n();
  const companyId = auth.company.id;
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [documents, payments] = await Promise.all([
    prisma.document.findMany({
      where: { companyId },
      select: {
        id: true,
        documentNumber: true,
        documentType: true,
        status: true,
        totalTTC: true,
        amountDue: true,
        issueDate: true,
        dueDate: true,
        createdAt: true,
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payment.findMany({
      where: { companyId },
      select: {
        id: true,
        amount: true,
        paymentDate: true,
        method: true,
        client: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { paymentDate: "desc" },
      take: 8,
    }),
  ]);

  const totalBilledMonth = documents
    .filter((doc) => doc.documentType === "FACTURE")
    .filter((doc) => {
      const date = doc.issueDate ?? doc.createdAt;
      return date >= currentMonthStart && date < nextMonthStart;
    })
    .reduce((sum, doc) => sum + toNumber(doc.totalTTC), 0);

  const unpaidTotal = documents
    .filter((doc) => doc.documentType === "FACTURE")
    .filter((doc) => !PAID_STATUSES.has(doc.status))
    .reduce((sum, doc) => sum + Math.max(0, toNumber(doc.amountDue)), 0);

  const dueSoonCount = documents.filter((doc) => {
    if (!doc.dueDate || CLOSED_STATUSES.has(doc.status)) {
      return false;
    }
    const days = (doc.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 7 && toNumber(doc.amountDue) > 0;
  }).length;

  const devisCount = documents.filter((doc) => doc.documentType === "DEVIS").length;
  const factureCount = documents.filter((doc) => doc.documentType === "FACTURE").length;
  const conversionRate = devisCount > 0 ? (factureCount / devisCount) * 100 : 0;

  const months = Array.from({ length: 6 }, (_, index) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      start: d,
      end: new Date(d.getFullYear(), d.getMonth() + 1, 1),
      label: monthLabel(d, locale),
    };
  });

  const monthlySeries = months.map((month) => {
    const monthDocs = documents.filter((doc) => {
      const date = doc.issueDate ?? doc.createdAt;
      return date >= month.start && date < month.end;
    });
    const invoicesHT = monthDocs
      .filter((doc) => doc.documentType === "FACTURE")
      .reduce((sum, doc) => sum + toNumber(doc.totalTTC), 0);
    return {
      label: month.label,
      documents: monthDocs.length,
      billed: invoicesHT,
    };
  });

  const maxMonthlyBilled = Math.max(1, ...monthlySeries.map((item) => item.billed));

  const statusKeys = ["DRAFT", "ISSUED", "SENT", "PAID", "OVERDUE", "CANCELLED"] as const;
  const statusDistribution = statusKeys.map((status) => {
    const count = documents.filter((doc) => doc.status === status).length;
    return { status, count };
  });
  const totalDocsCount = Math.max(1, documents.length);

  const recentDocuments = [...documents]
    .sort((a, b) => {
      const aDate = (a.issueDate ?? a.createdAt).getTime();
      const bDate = (b.issueDate ?? b.createdAt).getTime();
      return bDate - aDate;
    })
    .slice(0, 5);

  const overdueOrSoon = documents
    .filter((doc) => doc.documentType === "FACTURE")
    .filter((doc) => doc.dueDate && !CLOSED_STATUSES.has(doc.status) && toNumber(doc.amountDue) > 0)
    .map((doc) => {
      const days = Math.floor(((doc.dueDate as Date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: doc.id,
        number: doc.documentNumber,
        client: doc.client?.name || t("common.unknown"),
        dueDate: doc.dueDate as Date,
        amountDue: toNumber(doc.amountDue),
        days,
      };
    })
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .slice(0, 8);

  const topClientsMap = new Map<string, { name: string; billed: number; open: number; count: number }>();
  for (const doc of documents) {
    const clientId = doc.client?.id;
    if (!clientId) {
      continue;
    }
    const current = topClientsMap.get(clientId) || {
      name: doc.client?.name || t("common.unknown"),
      billed: 0,
      open: 0,
      count: 0,
    };
    current.billed += toNumber(doc.totalTTC);
    current.open += Math.max(0, toNumber(doc.amountDue));
    current.count += 1;
    topClientsMap.set(clientId, current);
  }
  const topClients = Array.from(topClientsMap.values())
    .sort((a, b) => b.billed - a.billed)
    .slice(0, 6);

  const paymentsThisMonth = payments
    .filter((payment) => payment.paymentDate >= currentMonthStart && payment.paymentDate < nextMonthStart)
    .reduce((sum, payment) => sum + toNumber(payment.amount), 0);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("dashboard.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("dashboard.subtitle")}
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label={t("dashboard.stats.totalBilledMonth")} value={money(totalBilledMonth)} hint={t("dashboard.stats.totalBilledMonthHint")} />
        <StatCard label={t("dashboard.stats.unpaidAmount")} value={money(unpaidTotal)} hint={t("dashboard.stats.unpaidAmountHint")} />
        <StatCard label={t("dashboard.stats.dueSoon")} value={String(dueSoonCount)} hint={t("dashboard.stats.dueSoonHint")} />
        <StatCard label={t("dashboard.stats.devisToFacture")} value={`${conversionRate.toFixed(1)}%`} hint={t("dashboard.stats.devisToFactureHint")} />
        <StatCard label={t("dashboard.stats.paymentsMonth")} value={money(paymentsThisMonth)} hint={t("dashboard.stats.paymentsMonthHint")} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-md border border-border bg-card/70 p-4">
          <h2 className="text-sm font-semibold text-foreground">{t("dashboard.charts.monthlyTrend.title")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("dashboard.charts.monthlyTrend.subtitle")}</p>
          <div className="mt-4 grid grid-cols-6 items-end gap-3">
            {monthlySeries.map((item) => {
              const ratio = item.billed / maxMonthlyBilled;
              const height = Math.max(8, Math.round(ratio * 120));
              return (
                <div key={item.label} className="flex flex-col items-center gap-2">
                  <div className="w-full rounded-sm border border-border bg-background/40 px-1 py-1 text-center text-[10px] text-muted-foreground">
                    {item.documents}
                  </div>
                  <div className="flex h-32 w-full items-end rounded-sm border border-border bg-background/30 p-1">
                    <div className="w-full rounded-sm bg-primary/35" style={{ height }} />
                  </div>
                  <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{item.label}</p>
                  <p className="text-[10px] text-foreground">{money(item.billed)}</p>
                </div>
              );
            })}
          </div>
        </article>

        <article className="rounded-md border border-border bg-card/70 p-4">
          <h2 className="text-sm font-semibold text-foreground">{t("dashboard.charts.statusDistribution.title")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("dashboard.charts.statusDistribution.subtitle")}</p>
          <div className="mt-4 space-y-3">
            {statusDistribution.map((item) => {
              const pct = (item.count / totalDocsCount) * 100;
              return (
                <div key={item.status} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t(STATUS_KEY_BY_VALUE[item.status] || "documents.status.draft")}</span>
                    <span className="text-foreground">
                      {item.count} ({pct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-sm border border-border bg-background/30 p-[1px]">
                    <div className="h-full rounded-sm bg-primary/35" style={{ width: `${Math.max(2, pct)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="overflow-x-auto rounded-md border border-border bg-card/70">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">{t("dashboard.tables.recentDocuments.title")}</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-background/70 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start">{t("dashboard.tables.recentDocuments.number")}</th>
                <th className="px-4 py-3 text-start">{t("dashboard.tables.recentDocuments.type")}</th>
                <th className="px-4 py-3 text-start">{t("dashboard.tables.recentDocuments.client")}</th>
                <th className="px-4 py-3 text-start">{t("dashboard.tables.recentDocuments.status")}</th>
                <th className="px-4 py-3 text-start">{t("dashboard.tables.recentDocuments.total")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card/50 text-xs text-muted-foreground">
              {recentDocuments.length ? (
                recentDocuments.map((doc) => (
                  <tr key={doc.id}>
                    <td className="px-4 py-3 text-foreground">{doc.documentNumber}</td>
                    <td className="px-4 py-3">{t(TYPE_KEY_BY_VALUE[doc.documentType] || "documents.types.devis")}</td>
                    <td className="px-4 py-3">{doc.client?.name || "-"}</td>
                    <td className="px-4 py-3">{t(STATUS_KEY_BY_VALUE[doc.status] || "documents.status.draft")}</td>
                    <td className="px-4 py-3">{money(toNumber(doc.totalTTC))}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-xs text-muted-foreground">
                    {t("dashboard.tables.recentDocuments.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </article>

        <article className="overflow-x-auto rounded-md border border-border bg-card/70">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">{t("dashboard.tables.upcomingOverdue.title")}</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-background/70 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start">{t("dashboard.tables.upcomingOverdue.invoice")}</th>
                <th className="px-4 py-3 text-start">{t("dashboard.tables.upcomingOverdue.client")}</th>
                <th className="px-4 py-3 text-start">{t("dashboard.tables.upcomingOverdue.dueDate")}</th>
                <th className="px-4 py-3 text-start">{t("dashboard.tables.upcomingOverdue.days")}</th>
                <th className="px-4 py-3 text-start">{t("dashboard.tables.upcomingOverdue.amountDue")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card/50 text-xs text-muted-foreground">
              {overdueOrSoon.length ? (
                overdueOrSoon.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-foreground">{item.number}</td>
                    <td className="px-4 py-3">{item.client}</td>
                    <td className="px-4 py-3">{formatDate(item.dueDate)}</td>
                    <td className={item.days < 0 ? "px-4 py-3 text-destructive" : "px-4 py-3 text-foreground"}>
                      {item.days}
                    </td>
                    <td className="px-4 py-3">{money(item.amountDue)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-xs text-muted-foreground">
                    {t("dashboard.tables.upcomingOverdue.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="overflow-x-auto rounded-md border border-border bg-card/70">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">{t("dashboard.tables.topClients.title")}</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-background/70 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start">{t("dashboard.tables.topClients.client")}</th>
                <th className="px-4 py-3 text-start">{t("dashboard.tables.topClients.docs")}</th>
                <th className="px-4 py-3 text-start">{t("dashboard.tables.topClients.billed")}</th>
                <th className="px-4 py-3 text-start">{t("dashboard.tables.topClients.open")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card/50 text-xs text-muted-foreground">
              {topClients.length ? (
                topClients.map((client) => (
                  <tr key={client.name}>
                    <td className="px-4 py-3 text-foreground">{client.name}</td>
                    <td className="px-4 py-3">{client.count}</td>
                    <td className="px-4 py-3">{money(client.billed)}</td>
                    <td className="px-4 py-3">{money(client.open)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-xs text-muted-foreground">
                    {t("dashboard.tables.topClients.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </article>

        <article className="overflow-x-auto rounded-md border border-border bg-card/70">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">{t("dashboard.tables.latestPayments.title")}</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-background/70 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start">{t("dashboard.tables.latestPayments.date")}</th>
                <th className="px-4 py-3 text-start">{t("dashboard.tables.latestPayments.client")}</th>
                <th className="px-4 py-3 text-start">{t("dashboard.tables.latestPayments.method")}</th>
                <th className="px-4 py-3 text-start">{t("dashboard.tables.latestPayments.amount")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card/50 text-xs text-muted-foreground">
              {payments.length ? (
                payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-3">{formatDate(payment.paymentDate)}</td>
                    <td className="px-4 py-3 text-foreground">{payment.client.name}</td>
                    <td className="px-4 py-3">{payment.method}</td>
                    <td className="px-4 py-3">{money(toNumber(payment.amount))}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-xs text-muted-foreground">
                    {t("dashboard.tables.latestPayments.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </article>
      </section>
    </div>
  );
}
