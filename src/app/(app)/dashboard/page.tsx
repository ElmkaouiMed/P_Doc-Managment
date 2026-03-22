import { requireAuthContext } from "@/features/auth/lib/session";
import { DashboardView, type DashboardFunnelDropOff, type DashboardFunnelLeadTime, type DashboardFunnelStep, type DashboardKpi } from "@/features/dashboard/components/dashboard-view";
import { readFunnelSummary } from "@/features/analytics/lib/funnel-events-reader";
import type { FunnelEventName } from "@/features/analytics/lib/funnel-event-names";
import { AppLocale } from "@/i18n/messages";
import { getServerI18n } from "@/i18n/server";
import { prisma } from "@/lib/db";
import { PageEducationBanner } from "@/components/marketing/page-education-banner";

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number, currency = "MAD") {
  return `${value.toFixed(2)} ${currency}`;
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
const FUNNEL_SEQUENCE: FunnelEventName[] = [
  "landing_view",
  "signup_start",
  "signup_complete",
  "trial_start",
  "first_document_created",
  "payment_proof_submitted",
  "account_activated",
];
const FUNNEL_LABEL_KEY_BY_EVENT: Record<FunnelEventName, string> = {
  landing_view: "dashboard.funnel.steps.landing_view",
  signup_start: "dashboard.funnel.steps.signup_start",
  signup_complete: "dashboard.funnel.steps.signup_complete",
  trial_start: "dashboard.funnel.steps.trial_start",
  first_document_created: "dashboard.funnel.steps.first_document_created",
  payment_proof_submitted: "dashboard.funnel.steps.payment_proof_submitted",
  account_activated: "dashboard.funnel.steps.account_activated",
  assist_modal_open: "dashboard.funnel.steps.assist_modal_open",
  assist_request_submitted: "dashboard.funnel.steps.assist_request_submitted",
  education_banner_view: "dashboard.funnel.steps.education_banner_view",
  education_video_click: "dashboard.funnel.steps.education_video_click",
  education_help_click: "dashboard.funnel.steps.education_help_click",
};

export default async function DashboardPage() {
  const auth = await requireAuthContext();
  const { locale, t } = await getServerI18n();
  const companyId = auth.company.id;
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const sixMonthsStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [documents, paymentsForTrend, latestPaymentsRaw, funnelSummary] = await Promise.all([
    prisma.document.findMany({
      where: { companyId },
      select: {
        id: true,
        documentNumber: true,
        documentType: true,
        status: true,
        totalTTC: true,
        amountDue: true,
        currency: true,
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
      where: {
        companyId,
        paymentDate: {
          gte: sixMonthsStart,
        },
      },
      select: {
        amount: true,
        paymentDate: true,
      },
      orderBy: { paymentDate: "desc" },
    }),
    prisma.payment.findMany({
      where: { companyId },
      select: {
        id: true,
        clientId: true,
        amount: true,
        paymentDate: true,
        method: true,
      },
      orderBy: { paymentDate: "desc" },
      take: 8,
    }),
    readFunnelSummary(30),
  ]);

  const latestPaymentClientIds = Array.from(
    new Set(
      latestPaymentsRaw
        .map((payment) => payment.clientId)
        .filter((clientId): clientId is string => typeof clientId === "string" && clientId.length > 0),
    ),
  );

  const latestPaymentClients = latestPaymentClientIds.length
    ? await prisma.client.findMany({
      where: {
        companyId,
        id: { in: latestPaymentClientIds },
      },
      select: {
        id: true,
        name: true,
      },
    })
    : [];

  const latestPaymentClientNameById = new Map(latestPaymentClients.map((client) => [client.id, client.name]));

  const summaryCurrency = documents.find((doc) => typeof doc.currency === "string" && doc.currency.trim().length > 0)?.currency || "MAD";
  const invoiceDocuments = documents.filter((doc) => doc.documentType === "FACTURE");

  const totalBilledMonth = invoiceDocuments
    .filter((doc) => {
      const date = doc.issueDate ?? doc.createdAt;
      return date >= currentMonthStart && date < nextMonthStart;
    })
    .reduce((sum, doc) => sum + toNumber(doc.totalTTC), 0);

  const unpaidTotal = invoiceDocuments
    .filter((doc) => !PAID_STATUSES.has(doc.status))
    .reduce((sum, doc) => sum + Math.max(0, toNumber(doc.amountDue)), 0);

  const dueSoonCount = invoiceDocuments.filter((doc) => {
    if (!doc.dueDate || CLOSED_STATUSES.has(doc.status)) {
      return false;
    }
    const days = (doc.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 7 && toNumber(doc.amountDue) > 0;
  }).length;

  const devisCount = documents.filter((doc) => doc.documentType === "DEVIS").length;
  const factureCount = invoiceDocuments.length;
  const conversionRate = devisCount > 0 ? (factureCount / devisCount) * 100 : 0;

  const paidInvoicesCount = invoiceDocuments.filter((doc) => PAID_STATUSES.has(doc.status)).length;
  const collectionRate = factureCount > 0 ? (paidInvoicesCount / factureCount) * 100 : 0;
  const averageInvoice = factureCount > 0 ? invoiceDocuments.reduce((sum, doc) => sum + toNumber(doc.totalTTC), 0) / factureCount : 0;

  const activeClientIds = new Set(
    documents
      .filter((doc) => {
        const date = doc.issueDate ?? doc.createdAt;
        return date >= currentMonthStart && date < nextMonthStart;
      })
      .map((doc) => doc.client?.id)
      .filter((id): id is string => Boolean(id)),
  );
  const activeClients = activeClientIds.size;

  const paymentsThisMonth = paymentsForTrend
    .filter((payment) => payment.paymentDate >= currentMonthStart && payment.paymentDate < nextMonthStart)
    .reduce((sum, payment) => sum + toNumber(payment.amount), 0);

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
    const billed = monthDocs
      .filter((doc) => doc.documentType === "FACTURE")
      .reduce((sum, doc) => sum + toNumber(doc.totalTTC), 0);
    const payments = paymentsForTrend
      .filter((payment) => payment.paymentDate >= month.start && payment.paymentDate < month.end)
      .reduce((sum, payment) => sum + toNumber(payment.amount), 0);
    return {
      label: month.label,
      billed,
      payments,
      documents: monthDocs.length,
    };
  });

  const statusKeys = ["DRAFT", "ISSUED", "SENT", "PAID", "OVERDUE", "CANCELLED"] as const;
  const statusDistribution = statusKeys.map((status) => ({
    label: t(STATUS_KEY_BY_VALUE[status] || "documents.status.draft"),
    count: documents.filter((doc) => doc.status === status).length,
  }));

  const recentDocuments = [...documents]
    .sort((a, b) => {
      const aDate = (a.issueDate ?? a.createdAt).getTime();
      const bDate = (b.issueDate ?? b.createdAt).getTime();
      return bDate - aDate;
    })
    .slice(0, 6)
    .map((doc) => ({
      id: doc.id,
      number: doc.documentNumber,
      typeLabel: t(TYPE_KEY_BY_VALUE[doc.documentType] || "documents.types.devis"),
      client: doc.client?.name || "-",
      statusLabel: t(STATUS_KEY_BY_VALUE[doc.status] || "documents.status.draft"),
      totalLabel: money(toNumber(doc.totalTTC), summaryCurrency),
      issuedOn: formatDate(doc.issueDate ?? doc.createdAt),
    }));

  const dueInvoices = invoiceDocuments
    .filter((doc) => doc.dueDate && !CLOSED_STATUSES.has(doc.status) && toNumber(doc.amountDue) > 0)
    .map((doc) => {
      const days = Math.floor(((doc.dueDate as Date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: doc.id,
        number: doc.documentNumber,
        client: doc.client?.name || t("common.unknown"),
        dueDate: formatDate(doc.dueDate),
        amountDueLabel: money(toNumber(doc.amountDue), summaryCurrency),
        days,
      };
    })
    .sort((a, b) => a.days - b.days)
    .slice(0, 8);

  const topClientsMap = new Map<string, { id: string; name: string; billed: number; open: number; docs: number }>();
  for (const doc of documents) {
    const clientId = doc.client?.id;
    if (!clientId) {
      continue;
    }
    const current = topClientsMap.get(clientId) || {
      id: clientId,
      name: doc.client?.name || t("common.unknown"),
      billed: 0,
      open: 0,
      docs: 0,
    };
    current.billed += toNumber(doc.totalTTC);
    current.open += Math.max(0, toNumber(doc.amountDue));
    current.docs += 1;
    topClientsMap.set(clientId, current);
  }
  const topClients = Array.from(topClientsMap.values())
    .sort((a, b) => b.billed - a.billed)
    .slice(0, 6)
    .map((client) => ({
      id: client.id,
      name: client.name,
      docs: client.docs,
      billedLabel: money(client.billed, summaryCurrency),
      openLabel: money(client.open, summaryCurrency),
      openRatio: client.billed > 0 ? (client.open / client.billed) * 100 : 0,
    }));

  const latestPayments = latestPaymentsRaw.map((payment) => ({
    id: payment.id,
    date: formatDate(payment.paymentDate),
    client: latestPaymentClientNameById.get(payment.clientId) || t("common.unknown"),
    method: payment.method,
    amountLabel: money(toNumber(payment.amount), summaryCurrency),
  }));

  const firstFunnelCount = funnelSummary.counts[FUNNEL_SEQUENCE[0]] || 0;
  const funnelSteps: DashboardFunnelStep[] = FUNNEL_SEQUENCE.map((eventName, index) => {
    const count = funnelSummary.counts[eventName] || 0;
    const previousCount = index > 0 ? funnelSummary.counts[FUNNEL_SEQUENCE[index - 1]] || 0 : 0;
    const rateFromPrevious = index > 0 && previousCount > 0 ? (count / previousCount) * 100 : null;
    const rateFromStart = firstFunnelCount > 0 ? (count / firstFunnelCount) * 100 : null;
    return {
      key: eventName,
      label: t(FUNNEL_LABEL_KEY_BY_EVENT[eventName]),
      count,
      rateFromPrevious,
      rateFromStart,
    };
  });
  const funnelWindowLabel = `${formatDate(funnelSummary.from)} -> ${formatDate(funnelSummary.to)}`;
  const funnelLeadTime: DashboardFunnelLeadTime = {
    samples: funnelSummary.leadTime.samples,
    avgHours: funnelSummary.leadTime.avgHours,
    medianHours: funnelSummary.leadTime.medianHours,
    p90Hours: funnelSummary.leadTime.p90Hours,
  };
  const funnelDayDropOff: DashboardFunnelDropOff[] = funnelSummary.dayDropOff.map((row) => ({
    key: `${row.fromEvent}_${row.toEvent}_day`,
    fromLabel: t(FUNNEL_LABEL_KEY_BY_EVENT[row.fromEvent]),
    toLabel: t(FUNNEL_LABEL_KEY_BY_EVENT[row.toEvent]),
    fromCount: row.fromCount,
    toCount: row.toCount,
    conversionRate: row.conversionRate,
    dropOffRate: row.dropOffRate,
  }));
  const funnelWeekDropOff: DashboardFunnelDropOff[] = funnelSummary.weekDropOff.map((row) => ({
    key: `${row.fromEvent}_${row.toEvent}_week`,
    fromLabel: t(FUNNEL_LABEL_KEY_BY_EVENT[row.fromEvent]),
    toLabel: t(FUNNEL_LABEL_KEY_BY_EVENT[row.toEvent]),
    fromCount: row.fromCount,
    toCount: row.toCount,
    conversionRate: row.conversionRate,
    dropOffRate: row.dropOffRate,
  }));

  const kpis: DashboardKpi[] = [
    {
      label: t("dashboard.stats.totalBilledMonth"),
      amount: totalBilledMonth,
      hint: t("dashboard.stats.totalBilledMonthHint"),
      metaTone: "positive",
    },
    {
      label: t("dashboard.stats.unpaidAmount"),
      amount: unpaidTotal,
      hint: t("dashboard.stats.unpaidAmountHint"),
      metaTone: "negative",
    },
    {
      label: t("dashboard.stats.dueSoon"),
      value: String(dueSoonCount),
      hint: t("dashboard.stats.dueSoonHint"),
      metaTone: "negative",
    },
    {
      label: t("dashboard.stats.devisToFacture"),
      value: `${conversionRate.toFixed(1)}%`,
      hint: t("dashboard.stats.devisToFactureHint"),
      metaTone: "positive",
    },
    {
      label: t("dashboard.stats.paymentsMonth"),
      amount: paymentsThisMonth,
      hint: t("dashboard.stats.paymentsMonthHint"),
      metaTone: "positive",
    },
    {
      label: t("dashboard.stats.collectionRate"),
      value: `${collectionRate.toFixed(1)}%`,
      hint: t("dashboard.stats.collectionRateHint"),
      metaTone: "positive",
    },
    {
      label: t("dashboard.stats.avgInvoice"),
      amount: averageInvoice,
      hint: t("dashboard.stats.avgInvoiceHint"),
      metaTone: "neutral",
    },
    {
      label: t("dashboard.stats.activeClients"),
      value: String(activeClients),
      hint: t("dashboard.stats.activeClientsHint"),
      metaTone: "positive",
    },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("dashboard.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("dashboard.subtitle")}
        </p>
      </header>

      <PageEducationBanner
        title={t("education.banner.dashboard.title")}
        description={t("education.banner.dashboard.description")}
        videoLabel={t("education.banner.common.watchVideo")}
        videoHref="https://www.youtube.com/watch?v=aqz-KE-bpKQ"
        helpLabel={t("education.banner.common.needHelp")}
        supportTitle={t("education.banner.support.title")}
        supportDescription={t("education.banner.support.description")}
        supportCallLabel={t("education.banner.support.call")}
        supportCloseLabel={t("education.banner.support.close")}
        sourceSection="education-dashboard"
        checklist={[
          t("education.banner.dashboard.point1"),
          t("education.banner.dashboard.point2"),
          t("education.banner.dashboard.point3"),
        ]}
      />

      <DashboardView
        currency={summaryCurrency}
        kpis={kpis}
        monthlySeries={monthlySeries}
        statusDistribution={statusDistribution}
        recentDocuments={recentDocuments}
        dueInvoices={dueInvoices}
        topClients={topClients}
        latestPayments={latestPayments}
        funnelSteps={funnelSteps}
        funnelWindowLabel={funnelWindowLabel}
        funnelTotalEvents={funnelSummary.totalEvents}
        funnelLeadTime={funnelLeadTime}
        funnelDayDropOff={funnelDayDropOff}
        funnelWeekDropOff={funnelWeekDropOff}
        showFunnel={false}
      />
    </div>
  );
}
