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

export type DashboardFunnelStep = {
  key: string;
  label: string;
  count: number;
  rateFromPrevious: number | null;
  rateFromStart: number | null;
};

export type DashboardFunnelDropOff = {
  key: string;
  fromLabel: string;
  toLabel: string;
  fromCount: number;
  toCount: number;
  conversionRate: number | null;
  dropOffRate: number | null;
};

export type DashboardFunnelLeadTime = {
  samples: number;
  avgHours: number | null;
  medianHours: number | null;
  p90Hours: number | null;
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
  funnelSteps?: DashboardFunnelStep[];
  funnelWindowLabel?: string;
  funnelTotalEvents?: number;
  funnelLeadTime?: DashboardFunnelLeadTime;
  funnelDayDropOff?: DashboardFunnelDropOff[];
  funnelWeekDropOff?: DashboardFunnelDropOff[];
  showFunnel?: boolean;
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
const CHART_HEIGHT_CLASS = "mt-4 text-sm h-[240px] sm:h-[280px] lg:h-[320px]";
const CHART_MIN_HEIGHT = 240;
const CHART_TOOLTIP_STYLE = {
  borderRadius: 10,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--foreground))",
} as const;

function formatMoney(value: number, currency: string) {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(2)} ${currency}`;
}

function formatCompactAmount(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  if (Math.abs(safe) >= 1_000_000) {
    return `${(safe / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(safe) >= 1_000) {
    return `${(safe / 1_000).toFixed(1)}K`;
  }
  return safe.toFixed(0);
}

function formatPercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return "-";
  }
  return `${value.toFixed(1)}%`;
}

function formatHours(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return "-";
  }
  if (Math.abs(value) >= 48) {
    return `${(value / 24).toFixed(1)}d`;
  }
  return `${value.toFixed(1)}h`;
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
  funnelSteps = [],
  funnelWindowLabel = "",
  funnelTotalEvents = 0,
  funnelLeadTime = { samples: 0, avgHours: null, medianHours: null, p90Hours: null },
  funnelDayDropOff = [],
  funnelWeekDropOff = [],
  showFunnel = false,
}: DashboardViewProps) {
  const { t } = useI18n();
  const statusData = statusDistribution.filter((item) => item.count > 0);
  const maxFunnelCount = funnelSteps.reduce((max, step) => Math.max(max, step.count), 0);
  const hasFunnelData = funnelSteps.some((step) => step.count > 0);

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

      {showFunnel ? (
        <section className="rounded-xl border border-border bg-card/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">{t("dashboard.funnel.title")}</h2>
            <span className="rounded-md border border-border/70 bg-background/35 px-2 py-1 text-[11px] text-muted-foreground">{funnelWindowLabel}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("dashboard.funnel.subtitle")}</p>

          {hasFunnelData ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {funnelSteps.map((step) => {
                const barWidth = maxFunnelCount > 0 ? Math.max(6, (step.count / maxFunnelCount) * 100) : 0;
                return (
                  <article key={step.key} className="rounded-lg border border-border/70 bg-background/30 p-3 transition hover:border-primary/30 hover:bg-background/50">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground">{step.label}</p>
                      <p className="text-xs font-semibold text-primary">{step.count}</p>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-background/60">
                      <div className="h-full rounded-full bg-primary/60" style={{ width: `${Math.max(0, Math.min(100, barWidth))}%` }} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <p>{t("dashboard.funnel.rateFromStart")}: {formatPercent(step.rateFromStart)}</p>
                      <p>{t("dashboard.funnel.rateFromPrevious")}: {formatPercent(step.rateFromPrevious)}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 rounded-lg border border-border/70 bg-background/20 px-3 py-6 text-center text-xs text-muted-foreground">
              {t("dashboard.funnel.empty")}
            </p>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            {t("dashboard.funnel.totalEvents")}: <span className="font-semibold text-foreground">{funnelTotalEvents}</span>
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-lg border border-border/70 bg-background/25 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">{t("dashboard.funnel.leadTime.samples")}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{funnelLeadTime.samples}</p>
            </article>
            <article className="rounded-lg border border-border/70 bg-background/25 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">{t("dashboard.funnel.leadTime.avg")}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{formatHours(funnelLeadTime.avgHours)}</p>
            </article>
            <article className="rounded-lg border border-border/70 bg-background/25 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">{t("dashboard.funnel.leadTime.median")}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{formatHours(funnelLeadTime.medianHours)}</p>
            </article>
            <article className="rounded-lg border border-border/70 bg-background/25 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">{t("dashboard.funnel.leadTime.p90")}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{formatHours(funnelLeadTime.p90Hours)}</p>
            </article>
          </div>

          <div className="mt-3 grid gap-2 xl:grid-cols-2">
            <article className="rounded-lg border border-border/70 bg-background/25 p-3">
              <p className="text-xs font-semibold text-foreground">{t("dashboard.funnel.dayDropOff.title")}</p>
              <div className="mt-2 space-y-1.5">
                {funnelDayDropOff.map((row) => (
                  <div key={row.key} className="rounded-md border border-border/60 bg-background/20 px-2 py-1.5 text-[11px]">
                    <p className="font-semibold text-foreground">
                      {row.fromLabel}
                      {" -> "}
                      {row.toLabel}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">
                      {row.fromCount}
                      {" -> "}
                      {row.toCount}
                      {" • "}
                      {t("dashboard.funnel.dayDropOff.conv")}: {formatPercent(row.conversionRate)}
                      {" • "}
                      {t("dashboard.funnel.dayDropOff.drop")}: {formatPercent(row.dropOffRate)}
                    </p>
                  </div>
                ))}
              </div>
            </article>
            <article className="rounded-lg border border-border/70 bg-background/25 p-3">
              <p className="text-xs font-semibold text-foreground">{t("dashboard.funnel.weekDropOff.title")}</p>
              <div className="mt-2 space-y-1.5">
                {funnelWeekDropOff.map((row) => (
                  <div key={row.key} className="rounded-md border border-border/60 bg-background/20 px-2 py-1.5 text-[11px]">
                    <p className="font-semibold text-foreground">
                      {row.fromLabel}
                      {" -> "}
                      {row.toLabel}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">
                      {row.fromCount}
                      {" -> "}
                      {row.toCount}
                      {" • "}
                      {t("dashboard.funnel.weekDropOff.conv")}: {formatPercent(row.conversionRate)}
                      {" • "}
                      {t("dashboard.funnel.weekDropOff.drop")}: {formatPercent(row.dropOffRate)}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-5">
        <article className="xl:col-span-3 rounded-xl border border-border bg-card/70 p-4">
          <h2 className="text-sm font-semibold text-foreground">{t("dashboard.charts.monthlyTrend.title")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("dashboard.charts.monthlyTrend.subtitle")}</p>
          <div className={CHART_HEIGHT_CLASS}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={CHART_MIN_HEIGHT}>
              <ComposedChart data={monthlySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 4" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  yAxisId="amount"
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `${formatCompactAmount(Number(value))} ${currency}`}
                />
                <YAxis yAxisId="docs" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value, name) => {
                    const numericValue = typeof value === "number" ? value : Number(value || 0);
                    const seriesKey = String(name);
                    if (seriesKey === "documents") {
                      return [String(numericValue), t("dashboard.charts.monthlyTrend.seriesDocuments")];
                    }
                    if (seriesKey === "payments") {
                      return [formatMoney(numericValue, currency), t("dashboard.charts.monthlyTrend.seriesPayments")];
                    }
                    return [formatMoney(numericValue, currency), t("dashboard.charts.monthlyTrend.seriesBilled")];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
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
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={CHART_MIN_HEIGHT}>
              <PieChart>
                <Pie data={statusData} dataKey="count" nameKey="label" innerRadius="52%" outerRadius="78%" paddingAngle={3}>
                  {statusData.map((entry, index) => (
                    <Cell key={`${entry.label}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
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
