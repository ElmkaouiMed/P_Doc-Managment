"use client";

import Link from "next/link";

import { useI18n } from "@/i18n/provider";
import { isDesktopBrowserMode } from "@/lib/runtime";
import { cn } from "@/lib/utils";

type CompanyAccountStatus =
  | "TRIAL_ACTIVE"
  | "TRIAL_EXPIRED"
  | "GRACE"
  | "AWAITING_ACTIVATION"
  | "ACTIVE_PAID"
  | "LOCKED";

type AccountLifecycleBannerState = {
  accountStatus: CompanyAccountStatus;
  trialEndsAt?: string | null;
  graceEndsAt?: string | null;
  trialDaysLeft?: number | null;
  graceDaysLeft?: number | null;
};

type AccountStatusBannerProps = {
  state: AccountLifecycleBannerState;
};

function toDateLabel(value: string | null | undefined, locale: string) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : locale === "en" ? "en-US" : "fr-FR", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

export function AccountStatusBanner({ state }: AccountStatusBannerProps) {
  const { t, locale } = useI18n();
  if (isDesktopBrowserMode()) {
    return null;
  }
  if (state.accountStatus === "ACTIVE_PAID") {
    return null;
  }

  const trialDate = toDateLabel(state.trialEndsAt, locale);
  const graceDate = toDateLabel(state.graceEndsAt, locale);
  const paletteByStatus: Record<CompanyAccountStatus, string> = {
    TRIAL_ACTIVE: "border-primary/40 bg-primary/10 text-foreground",
    TRIAL_EXPIRED: "border-amber-500/40 bg-amber-500/10 text-foreground",
    GRACE: "border-amber-500/40 bg-amber-500/10 text-foreground",
    AWAITING_ACTIVATION: "border-sky-500/40 bg-sky-500/10 text-foreground",
    ACTIVE_PAID: "border-primary/40 bg-primary/10 text-foreground",
    LOCKED: "border-destructive/45 bg-destructive/12 text-foreground",
  };

  const titleByStatus: Record<CompanyAccountStatus, string> = {
    TRIAL_ACTIVE: t("account.status.trialActive"),
    TRIAL_EXPIRED: t("account.status.trialExpired"),
    GRACE: t("account.status.grace"),
    AWAITING_ACTIVATION: t("account.status.awaitingActivation"),
    ACTIVE_PAID: "",
    LOCKED: t("account.status.locked"),
  };

  const detail =
    state.accountStatus === "TRIAL_ACTIVE"
      ? t("account.status.trialDetails")
          .replace("{days}", String(Math.max(0, state.trialDaysLeft ?? 0)))
          .replace("{date}", trialDate || "-")
      : state.accountStatus === "GRACE"
        ? t("account.status.graceDetails")
            .replace("{days}", String(Math.max(0, state.graceDaysLeft ?? 0)))
            .replace("{date}", graceDate || "-")
        : state.accountStatus === "TRIAL_EXPIRED"
          ? t("account.status.trialExpiredDetails")
          : state.accountStatus === "AWAITING_ACTIVATION"
            ? t("account.status.awaitingActivationDetails")
            : t("account.status.lockedDetails");

  return (
    <div className={cn("flex flex-col gap-3 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between", paletteByStatus[state.accountStatus])}>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{titleByStatus[state.accountStatus]}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      <Link
        href="/settings?tab=billing"
        className="inline-flex h-8 items-center justify-center rounded-sm border border-border bg-background/60 px-3 text-xs font-semibold text-foreground transition hover:border-primary/50"
      >
        {t("account.status.manageBilling")}
      </Link>
    </div>
  );
}
