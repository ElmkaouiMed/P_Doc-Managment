"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { StatCard } from "@/components/common/stat-card";
import { useI18n } from "@/i18n/provider";

type MetaTone = "neutral" | "positive" | "negative";

export type DashboardKpi = {
  label: string;
  hint: string;
  value?: string;
  amount?: number;
  metaTone?: MetaTone;
};

export type DashboardMonthlyPoint = {
  label: string;
  billed: number;
  payments: number;
  documents: number;
};

export type DashboardStatusPoint = {
  label: string;
  count: number;
};

export type DashboardRecentDocument = {
  id: string;
  number: string;
  typeLabel: string;
  client: string;
  statusLabel: string;
  totalLabel: string;
  issuedOn: string;
};

export type DashboardDueItem = {
  id: string;
  number: string;
  client: string;
  dueDate: string;
  days: number;
  amountDueLabel: string;
};

export type DashboardTopClientItem = {
  id: string;
  name: string;
  docs: number;
  billedLabel: string;
  openLabel: string;
  openRatio: number;
};

export type DashboardPaymentItem = {
  id: string;
  date: string;
  client: string;
  method: string;
  amountLabel: string;
};

type DashboardViewProps = {
  currency: string;
  kpis: DashboardKpi[];
  monthlySeries: DashboardMonthlyPoint[];
  statusDistribution: DashboardStatusPoint[];
  recentDocuments: DashboardRecentDocument[];
  dueInvoices: DashboardDueItem[];
  topClients: DashboardTopClientItem[];
  latestPayments: DashboardPaymentItem[];
};

const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
] as const;

const CHART_COLORS = {
  billed: "hsl(var(--chart-1))",
  payments: "hsl(var(--chart-2))",
  documents: "hsl(var(--chart-6))",
} as const;
const CHART_HEIGHT_CLASS = "mt-4 h-[240px] sm:h-[300px] lg:h-[340px]";

function formatMoney(value: number, currency: string) {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(2)} ${currency}`;
}

export function DashboardView({
  currency,
  kpis,
  monthlySeries,
  statusDistribution,
  recentDocuments,
  dueInvoices,
  topClients,
  latestPayments,
}: DashboardViewProps) {
  const { t } = useI18n();
  const statusData = statusDistribution.filter((item) => item.count > 0);

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <StatCard
            key={item.label}
            label={item.label}
            hint={item.hint}
            value={item.value}
            amount={item.amount}
            currency={currency}
            metaTone={item.metaTone || "neutral"}
          />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-5">
        <article className="xl:col-span-3 rounded-xl border border-border bg-card/70 p-4">
          <h2 className="text-sm font-semibold text-foreground">{t("dashboard.charts.monthlyTrend.title")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("dashboard.charts.monthlyTrend.subtitle")}</p>
          <div className={CHART_HEIGHT_CLASS}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 4" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  yAxisId="amount"
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => formatMoney(Number(value), currency)}
                />
                <YAxis yAxisId="docs" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === "documents") {
                      return [String(value), t("dashboard.charts.monthlyTrend.seriesDocuments")];
                    }
                    if (name === "payments") {
                      return [formatMoney(Number(value), currency), t("dashboard.charts.monthlyTrend.seriesPayments")];
                    }
                    return [formatMoney(Number(value), currency), t("dashboard.charts.monthlyTrend.seriesBilled")];
                  }}
                />
                <Legend />
                <Bar
                  yAxisId="amount"
                  dataKey="billed"
                  name={t("dashboard.charts.monthlyTrend.seriesBilled")}
                  fill={CHART_COLORS.billed}
                  radius={[6, 6, 0, 0]}
                />
                <Line
                  yAxisId="amount"
                  type="monotone"
                  dataKey="payments"
                  name={t("dashboard.charts.monthlyTrend.seriesPayments")}
                  stroke={CHART_COLORS.payments}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  yAxisId="docs"
                  type="monotone"
                  dataKey="documents"
                  name={t("dashboard.charts.monthlyTrend.seriesDocuments")}
                  stroke={CHART_COLORS.documents}
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="xl:col-span-2 rounded-xl border border-border bg-card/70 p-4">
          <h2 className="text-sm font-semibold text-foreground">{t("dashboard.charts.statusDistribution.title")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("dashboard.charts.statusDistribution.subtitle")}</p>
          <div className={CHART_HEIGHT_CLASS}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="count" nameKey="label" innerRadius="52%" outerRadius="78%" paddingAngle={3}>
                  {statusData.map((entry, index) => (
                    <Cell key={`${entry.label}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-xl border border-border bg-card/70 p-4">
          <h3 className="text-sm font-semibold text-foreground">{t("dashboard.tables.recentDocuments.title")}</h3>
          <div className="mt-3 space-y-2">
            {recentDocuments.length ? (
              recentDocuments.map((doc) => (
                <div key={doc.id} className="rounded-lg border border-border/70 bg-background/30 p-3 transition hover:border-primary/30 hover:bg-background/50">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{doc.number}</p>
                      <p className="text-xs text-muted-foreground">{doc.typeLabel}</p>
                    </div>
                    <p className="text-sm font-semibold text-primary">{doc.totalLabel}</p>
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                    <p>{t("dashboard.tables.recentDocuments.client")}: {doc.client}</p>
                    <p>{t("dashboard.tables.recentDocuments.status")}: {doc.statusLabel}</p>
                    <p className="sm:text-end">{doc.issuedOn}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-border/70 bg-background/20 px-3 py-6 text-center text-xs text-muted-foreground">
                {t("dashboard.tables.recentDocuments.empty")}
              </p>
            )}
          </div>
        </article>

        <article className="rounded-xl border border-border bg-card/70 p-4">
          <h3 className="text-sm font-semibold text-foreground">{t("dashboard.tables.upcomingOverdue.title")}</h3>
          <div className="mt-3 space-y-2">
            {dueInvoices.length ? (
              dueInvoices.map((item) => (
                <div key={item.id} className="rounded-lg border border-border/70 bg-background/30 p-3 transition hover:border-primary/30 hover:bg-background/50">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.number}</p>
                      <p className="text-xs text-muted-foreground">{item.client}</p>
                    </div>
                    <span
                      className={
                        item.days < 0
                          ? "inline-flex rounded-full border border-destructive/40 bg-destructive/15 px-2 py-1 text-[11px] font-semibold text-destructive"
                          : "inline-flex rounded-full border border-primary/35 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary"
                      }
                    >
                      {item.days} {t("dashboard.tables.upcomingOverdue.days")}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <p>{t("dashboard.tables.upcomingOverdue.dueDate")}: {item.dueDate}</p>
                    <p className="sm:text-end">{item.amountDueLabel}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-border/70 bg-background/20 px-3 py-6 text-center text-xs text-muted-foreground">
                {t("dashboard.tables.upcomingOverdue.empty")}
              </p>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-xl border border-border bg-card/70 p-4">
          <h3 className="text-sm font-semibold text-foreground">{t("dashboard.tables.topClients.title")}</h3>
          <div className="mt-3 space-y-2">
            {topClients.length ? (
              topClients.map((client) => (
                <div key={client.id} className="rounded-lg border border-border/70 bg-background/30 p-3 transition hover:border-primary/30 hover:bg-background/50">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{client.name}</p>
                      <p className="text-xs text-muted-foreground">{client.docs} {t("dashboard.tables.topClients.docs")}</p>
                    </div>
                    <div className="text-end">
                      <p className="text-sm font-semibold text-primary">{client.billedLabel}</p>
                      <p className="text-xs text-muted-foreground">{client.openLabel}</p>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-background/60">
                    <div className="h-full rounded-full bg-primary/60" style={{ width: `${Math.max(0, Math.min(100, client.openRatio))}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-border/70 bg-background/20 px-3 py-6 text-center text-xs text-muted-foreground">
                {t("dashboard.tables.topClients.empty")}
              </p>
            )}
          </div>
        </article>

        <article className="rounded-xl border border-border bg-card/70 p-4">
          <h3 className="text-sm font-semibold text-foreground">{t("dashboard.tables.latestPayments.title")}</h3>
          <div className="mt-3 space-y-2">
            {latestPayments.length ? (
              latestPayments.map((payment) => (
                <div key={payment.id} className="rounded-lg border border-border/70 bg-background/30 p-3 transition hover:border-primary/30 hover:bg-background/50">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{payment.client}</p>
                      <p className="text-xs text-muted-foreground">{payment.method}</p>
                    </div>
                    <div className="text-end">
                      <p className="text-sm font-semibold text-primary">{payment.amountLabel}</p>
                      <p className="text-xs text-muted-foreground">{payment.date}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-border/70 bg-background/20 px-3 py-6 text-center text-xs text-muted-foreground">
                {t("dashboard.tables.latestPayments.empty")}
              </p>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
