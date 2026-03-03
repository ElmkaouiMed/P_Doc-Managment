import Link from "next/link";
import { redirect } from "next/navigation";

import { signInAction, signUpAction } from "@/features/auth/actions";
import { ensureDemoAccount } from "@/features/auth/lib/demo";
import { getAuthContext } from "@/features/auth/lib/session";
import { getServerI18n } from "@/i18n/server";

type LoginPageProps = {
  searchParams?: Promise<{
    mode?: string;
    error?: string;
  }>;
};

const AUTH_ERROR_KEY_BY_VALUE: Record<string, string> = {
  "auth.errors.emailPasswordRequired": "auth.errors.emailPasswordRequired",
  "auth.errors.invalidCredentials": "auth.errors.invalidCredentials",
  "auth.errors.allFieldsRequired": "auth.errors.allFieldsRequired",
  "auth.errors.passwordTooShort": "auth.errors.passwordTooShort",
  "auth.errors.emailAlreadyUsed": "auth.errors.emailAlreadyUsed",
  "auth.errors.databaseUnavailable": "auth.errors.databaseUnavailable",
  "Email and password are required.": "auth.errors.emailPasswordRequired",
  "Invalid credentials.": "auth.errors.invalidCredentials",
  "All fields are required.": "auth.errors.allFieldsRequired",
  "Password must be at least 8 characters.": "auth.errors.passwordTooShort",
  "Email is already used.": "auth.errors.emailAlreadyUsed",
  "Database is currently unavailable. Please try again in a moment.": "auth.errors.databaseUnavailable",
};

function resolveAuthError(rawError: string | undefined, t: (key: string) => string) {
  if (!rawError) {
    return "";
  }
  const decoded = decodeURIComponent(rawError);
  const key = AUTH_ERROR_KEY_BY_VALUE[decoded];
  if (key) {
    return t(key);
  }
  return decoded;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const auth = await getAuthContext();
  if (auth) {
    redirect("/dashboard");
  }

  const { t } = await getServerI18n();
  const demo = await ensureDemoAccount();
  const params = (await searchParams) ?? {};
  const mode = params.mode === "signup" ? "signup" : "signin";
  const errorMessage = resolveAuthError(params.error, t);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="grid w-full max-w-5xl gap-4 lg:grid-cols-[1.15fr_1fr]">
        <section className="space-y-4 rounded-md border border-border bg-card/80 p-6">
          <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">DOC_v1</p>
          <h1 className="text-2xl font-semibold text-foreground">{t("auth.login.heroTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("auth.login.heroSubtitle")}
          </p>

          <div className="space-y-2 rounded-md border border-primary/30 bg-primary/10 p-4 text-xs">
            <p className="font-semibold text-primary">{t("auth.login.demoTitle")}</p>
            <p className="text-muted-foreground">{t("auth.login.demoEmail")}: {demo.email}</p>
            <p className="text-muted-foreground">{t("auth.login.demoPassword")}: {demo.password}</p>
          </div>

          <p className="text-xs text-muted-foreground">
            {t("auth.login.postLoginPrefix")} <span className="font-semibold text-foreground">/dashboard</span>{t("auth.login.postLoginSuffix")}
          </p>
        </section>

        <section className="space-y-4 rounded-md border border-border bg-card/80 p-6">
          <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-background/50 p-1">
            <Link
              href="/login?mode=signin"
              className={
                mode === "signin"
                  ? "rounded-sm bg-primary/20 px-3 py-2 text-center text-xs font-semibold text-primary"
                  : "rounded-sm px-3 py-2 text-center text-xs font-semibold text-muted-foreground"
              }
            >
              {t("auth.login.signInTab")}
            </Link>
            <Link
              href="/login?mode=signup"
              className={
                mode === "signup"
                  ? "rounded-sm bg-primary/20 px-3 py-2 text-center text-xs font-semibold text-primary"
                  : "rounded-sm px-3 py-2 text-center text-xs font-semibold text-muted-foreground"
              }
            >
              {t("auth.login.signUpTab")}
            </Link>
          </div>

          {errorMessage ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{errorMessage}</div>
          ) : null}

          {mode === "signin" ? (
            <form action={signInAction} className="grid gap-3">
              <label className="grid gap-1 text-xs">
                {t("auth.login.emailLabel")}
                <input name="email" type="email" className={inputClass} placeholder={t("auth.login.emailPlaceholder")} required />
              </label>
              <label className="grid gap-1 text-xs">
                {t("auth.login.passwordLabel")}
                <input name="password" type="password" className={inputClass} placeholder={t("auth.login.passwordPlaceholderSignIn")} required />
              </label>
              <button type="submit" className={submitClass}>
                {t("auth.login.signInSubmit")}
              </button>
            </form>
          ) : (
            <form action={signUpAction} className="grid gap-3">
              <label className="grid gap-1 text-xs">
                {t("auth.login.fullNameLabel")}
                <input name="fullName" className={inputClass} placeholder={t("auth.login.fullNamePlaceholder")} required />
              </label>
              <label className="grid gap-1 text-xs">
                {t("auth.login.companyNameLabel")}
                <input name="companyName" className={inputClass} placeholder={t("auth.login.companyNamePlaceholder")} required />
              </label>
              <label className="grid gap-1 text-xs">
                {t("auth.login.emailLabel")}
                <input name="email" type="email" className={inputClass} placeholder={t("auth.login.emailPlaceholder")} required />
              </label>
              <label className="grid gap-1 text-xs">
                {t("auth.login.passwordLabel")}
                <input name="password" type="password" className={inputClass} placeholder={t("auth.login.passwordPlaceholderSignUp")} required minLength={8} />
              </label>
              <button type="submit" className={submitClass}>
                {t("auth.login.signUpSubmit")}
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

const inputClass =
  "h-10 rounded-md border border-border bg-background/60 px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40";
const submitClass =
  "inline-flex h-10 items-center justify-center rounded-md border border-primary/40 bg-primary/10 px-3 text-xs font-semibold text-primary transition hover:border-primary hover:text-primary-foreground";
