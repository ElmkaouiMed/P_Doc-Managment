"use client";

import { useMemo, useState } from "react";

type PricingPlan = {
  name: string;
  monthly: string;
  yearly: string;
  note: string;
  features: string[];
  highlighted?: boolean;
};

type PricingCardsProps = {
  plans: PricingPlan[];
  monthlyLabel: string;
  yearlyLabel: string;
  saveLabel: string;
};

export function PricingCards({ plans, monthlyLabel, yearlyLabel, saveLabel }: PricingCardsProps) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const activePlans = useMemo(
    () =>
      plans.map((plan) => ({
        ...plan,
        activePrice: billingCycle === "monthly" ? plan.monthly : plan.yearly,
      })),
    [billingCycle, plans],
  );

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-md border border-border bg-card/70 p-1">
        <button
          type="button"
          onClick={() => setBillingCycle("monthly")}
          className={
            billingCycle === "monthly"
              ? "rounded-sm bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary"
              : "rounded-sm px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          }
        >
          {monthlyLabel}
        </button>
        <button
          type="button"
          onClick={() => setBillingCycle("yearly")}
          className={
            billingCycle === "yearly"
              ? "rounded-sm bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary"
              : "rounded-sm px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          }
        >
          {yearlyLabel}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {activePlans.map((plan) => (
          <article
            key={plan.name}
            className={
              plan.highlighted
                ? "rounded-xl border border-primary/40 bg-primary/10 p-4"
                : "rounded-xl border border-border bg-card/70 p-4"
            }
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-foreground">{plan.name}</h3>
              <span className="rounded-sm border border-border px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {plan.note}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{plan.activePrice}</p>
              {billingCycle === "yearly" ? (
                <span className="rounded-sm border border-primary/35 bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  {saveLabel}
                </span>
              ) : null}
            </div>
            <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              {plan.features.map((feature) => (
                <p key={feature}>- {feature}</p>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
