import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Call02Icon,
  FileBlockIcon,
  HelpCircleIcon,
  Logout02Icon,
  Mail01Icon,
} from "@hugeicons/core-free-icons";

import { HugIcon } from "@/components/ui/hug-icon";
import { signOutAction } from "@/features/auth/actions";
import { requireAuthContext } from "@/features/auth/lib/session";
import { getServerI18n } from "@/i18n/server";

function formatLockedAt(input: Date | null, locale: string) {
  if (!input) {
    return "-";
  }
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(input);
  } catch {
    return input.toISOString();
  }
}

function normalizePhoneToTel(phone: string) {
  return phone.replace(/[^\d+]/g, "");
}

export default async function AccountSuspendedPage() {
  const auth = await requireAuthContext();
  const { t, locale } = await getServerI18n();

  if (auth.company.accountStatus !== "LOCKED") {
    redirect("/dashboard");
  }

  const supportPhones = [
    (process.env.SUPPORT_PHONE_1 || "+212 600 000 000").trim(),
    (process.env.SUPPORT_PHONE_2 || "+212 500 000 000").trim(),
  ].filter((value) => value.length > 0);
  const supportEmail = (process.env.SUPPORT_EMAIL || "support@docv1.app").trim();
  const lockedAt = formatLockedAt(auth.company.lockedAt, locale);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8">
      <div className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-destructive/15 blur-3xl" />
      <div className="pointer-events-none absolute right-0 bottom-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />

      <section className="relative z-10 w-full max-w-2xl space-y-5 rounded-xl border border-border/80 bg-card/90 p-6 shadow-xl shadow-black/30">
        <div className="inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-destructive">
          <HugIcon icon={FileBlockIcon} size={14} />
          DOC_v1
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">{t("account.suspended.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("account.suspended.description").replace("{company}", auth.company.name)}</p>
        </div>

        <div className="rounded-lg border border-destructive/35 bg-destructive/10 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{t("account.suspended.reasonLabel")}</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{t("account.status.locked")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("account.suspended.lockedAt").replace("{date}", lockedAt)}</p>
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-background/40 p-4">
          <p className="text-sm font-semibold text-foreground">{t("account.suspended.contactTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("account.suspended.contactHint")}</p>

          <div className="grid gap-2 sm:grid-cols-2">
            {supportPhones.map((phone) => (
              <Link
                key={phone}
                href={`tel:${normalizePhoneToTel(phone)}`}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background/60 px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary/40"
              >
                <HugIcon icon={Call02Icon} size={14} />
                {phone}
              </Link>
            ))}
            <Link
              href={`mailto:${supportEmail}`}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background/60 px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary/40"
            >
              <HugIcon icon={Mail01Icon} size={14} />
              {supportEmail}
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-4">
          <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <HugIcon icon={HelpCircleIcon} size={14} />
            {t("account.suspended.footerHint")}
          </p>
          <form action={signOutAction}>
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background/60 px-3 text-xs font-semibold text-foreground transition hover:border-primary/40"
            >
              <HugIcon icon={Logout02Icon} size={14} />
              {t("account.suspended.signOut")}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
