type StatCardMetaTone = "neutral" | "positive" | "negative";

interface StatCardProps {
  label: string;
  value?: string;
  amount?: number;
  currency?: string;
  hint?: string;
  metaTone?: StatCardMetaTone;
  decimals?: number;
}

function formatAmount(value: number, decimals: number) {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toFixed(decimals);
}

export function StatCard({
  label,
  value,
  amount,
  currency = "MAD",
  hint,
  metaTone = "neutral",
  decimals = 2,
}: StatCardProps) {
  const metaToneClass =
    metaTone === "positive" ? "text-primary" : metaTone === "negative" ? "text-destructive" : "text-muted-foreground";
  const hasAmount = typeof amount === "number";

  return (
    <article className="rounded-md border border-border bg-card/70 p-4">
      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      {hasAmount ? (
        <p className="mt-2 flex items-end gap-1.5">
          <span className="text-2xl font-semibold text-foreground">{formatAmount(amount, decimals)}</span>
          <span className={`mb-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${metaToneClass}`}>{currency}</span>
        </p>
      ) : (
        <p className="mt-2 text-2xl font-semibold text-foreground">{value || "-"}</p>
      )}
      {hint ? <p className={`mt-1 text-[11px] ${metaToneClass}`}>{hint}</p> : null}
    </article>
  );
}
