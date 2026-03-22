import { CompanyAccountStatus, ExportStatus, SubscriptionStatus } from "@/lib/db-client";

import { prisma } from "@/lib/db";
import { isDesktopMode } from "@/lib/runtime";

export type UsageLimitKey = "documents_per_month" | "exports_per_month";

type UsagePeriod = {
  start: Date;
  end: Date;
};

type UsageLimitResult = {
  key: UsageLimitKey;
  period: UsagePeriod;
  used: number;
  limit: number | null;
  remaining: number | null;
  planCode: string | null;
};

type UsageLimitCheck = {
  ok: boolean;
  error: string | null;
  snapshot: UsageLimitResult;
};

const LIMIT_NAMES: Record<UsageLimitKey, string> = {
  documents_per_month: "document",
  exports_per_month: "export",
};

const SUBSCRIPTION_PRIORITY: Record<SubscriptionStatus, number> = {
  [SubscriptionStatus.ACTIVE]: 4,
  [SubscriptionStatus.TRIAL]: 3,
  [SubscriptionStatus.PAST_DUE]: 2,
  [SubscriptionStatus.SUSPENDED]: 1,
  [SubscriptionStatus.CANCELED]: 0,
};

const PLAN_CODE_FALLBACK_LIMITS: Record<string, Record<UsageLimitKey, number>> = {
  STARTER: {
    documents_per_month: 60,
    exports_per_month: 40,
  },
  PRO: {
    documents_per_month: 250,
    exports_per_month: 160,
  },
  BUSINESS: {
    documents_per_month: 1200,
    exports_per_month: 800,
  },
};

function parsePositiveInt(raw: string | undefined, fallback: number) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.floor(parsed));
}

function isTrialLikeStatus(status: CompanyAccountStatus) {
  return status === CompanyAccountStatus.TRIAL_ACTIVE || status === CompanyAccountStatus.TRIAL_EXPIRED || status === CompanyAccountStatus.GRACE;
}

function getDefaultLimitByKey(key: UsageLimitKey, isTrialLike: boolean) {
  if (key === "documents_per_month") {
    return isTrialLike
      ? parsePositiveInt(process.env.LIMIT_DOCUMENTS_PER_MONTH_TRIAL, 40)
      : parsePositiveInt(process.env.LIMIT_DOCUMENTS_PER_MONTH_DEFAULT, 250);
  }
  return isTrialLike
    ? parsePositiveInt(process.env.LIMIT_EXPORTS_PER_MONTH_TRIAL, 20)
    : parsePositiveInt(process.env.LIMIT_EXPORTS_PER_MONTH_DEFAULT, 160);
}

function resolveCurrentMonthPeriod(now = new Date()): UsagePeriod {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { start, end };
}

function findBestSubscription(
  subscriptions: Array<{
    status: SubscriptionStatus;
    plan: {
      code: string;
      limits: Array<{
        key: string;
        valueInt: number | null;
        isUnlimited: boolean;
      }>;
    };
    updatedAt: Date;
  }>,
) {
  if (!subscriptions.length) {
    return null;
  }
  return [...subscriptions].sort((a, b) => {
    const diff = SUBSCRIPTION_PRIORITY[b.status] - SUBSCRIPTION_PRIORITY[a.status];
    if (diff !== 0) {
      return diff;
    }
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  })[0];
}

function resolveLimitFromSubscription(
  key: UsageLimitKey,
  subscription: {
    plan: {
      code: string;
      limits: Array<{
        key: string;
        valueInt: number | null;
        isUnlimited: boolean;
      }>;
    };
  } | null,
  isTrialLike: boolean,
) {
  if (!subscription) {
    return getDefaultLimitByKey(key, isTrialLike);
  }

  const limitRow = subscription.plan.limits.find((row) => row.key === key);
  if (limitRow) {
    if (limitRow.isUnlimited) {
      return null;
    }
    if (limitRow.valueInt != null && Number.isFinite(limitRow.valueInt)) {
      return Math.max(0, Math.floor(limitRow.valueInt));
    }
  }

  const planCode = subscription.plan.code.trim().toUpperCase();
  const byPlan = PLAN_CODE_FALLBACK_LIMITS[planCode];
  if (byPlan && Number.isFinite(byPlan[key])) {
    return Math.max(0, Math.floor(byPlan[key]));
  }

  return getDefaultLimitByKey(key, isTrialLike);
}

async function countUsageForKey(companyId: string, key: UsageLimitKey, period: UsagePeriod) {
  if (key === "documents_per_month") {
    return prisma.document.count({
      where: {
        companyId,
        createdAt: {
          gte: period.start,
          lt: period.end,
        },
      },
    });
  }
  return prisma.exportJob.count({
    where: {
      companyId,
      status: {
        in: [ExportStatus.PENDING, ExportStatus.RUNNING, ExportStatus.COMPLETED],
      },
      createdAt: {
        gte: period.start,
        lt: period.end,
      },
    },
  });
}

function buildLimitErrorMessage(snapshot: UsageLimitResult) {
  const limit = snapshot.limit ?? 0;
  const used = snapshot.used;
  const label = LIMIT_NAMES[snapshot.key];
  const resetAt = snapshot.period.end.toISOString().slice(0, 10);
  return `Monthly ${label} limit reached (${used}/${limit}). Limit resets on ${resetAt}.`;
}

export async function getCompanyUsageLimitSnapshot(companyId: string, key: UsageLimitKey, now = new Date()): Promise<UsageLimitResult> {
  if (isDesktopMode()) {
    const period = resolveCurrentMonthPeriod(now);
    const used = await countUsageForKey(companyId, key, period);
    return {
      key,
      period,
      used,
      limit: null,
      remaining: null,
      planCode: "DESKTOP_LOCAL",
    };
  }

  const period = resolveCurrentMonthPeriod(now);

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      accountStatus: true,
      subscriptions: {
        where: {
          status: {
            in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.PAST_DUE, SubscriptionStatus.SUSPENDED],
          },
        },
        orderBy: [{ updatedAt: "desc" }],
        include: {
          plan: {
            select: {
              code: true,
              limits: {
                where: {
                  key: {
                    in: ["documents_per_month", "exports_per_month"],
                  },
                },
                select: {
                  key: true,
                  valueInt: true,
                  isUnlimited: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const subscription = findBestSubscription(company?.subscriptions ?? []);
  const isTrialLike = isTrialLikeStatus(company?.accountStatus ?? CompanyAccountStatus.ACTIVE_PAID);
  const limit = resolveLimitFromSubscription(key, subscription, isTrialLike);
  const used = await countUsageForKey(companyId, key, period);

  return {
    key,
    period,
    used,
    limit,
    remaining: limit == null ? null : Math.max(0, limit - used),
    planCode: subscription?.plan.code || null,
  };
}

export async function ensureCompanyUsageWithinLimit(input: {
  companyId: string;
  key: UsageLimitKey;
  increment?: number;
  now?: Date;
}): Promise<UsageLimitCheck> {
  const increment = Number.isFinite(input.increment) ? Math.max(1, Math.floor(input.increment || 1)) : 1;
  const snapshot = await getCompanyUsageLimitSnapshot(input.companyId, input.key, input.now || new Date());

  if (snapshot.limit == null) {
    return { ok: true, error: null, snapshot };
  }

  const nextTotal = snapshot.used + increment;
  if (nextTotal <= snapshot.limit) {
    return { ok: true, error: null, snapshot };
  }

  return {
    ok: false,
    error: buildLimitErrorMessage(snapshot),
    snapshot,
  };
}
