"use client";

import { MsgBoxProvider } from "@/components/ui/msg-box";
import { ToastProvider } from "@/components/ui/toast";
import { useI18n, I18nProvider } from "@/i18n/provider";
import { AppLocale } from "@/i18n/messages";
import { cn } from "@/lib/utils";

type AppProvidersProps = {
  children: React.ReactNode;
  fontVariables: string;
  initialLocale: AppLocale;
};

type FontScopeProps = {
  children: React.ReactNode;
  fontVariables: string;
};

export function AppProviders({ children, fontVariables, initialLocale }: AppProvidersProps) {
  return (
    <I18nProvider initialLocale={initialLocale}>
      <FontScope fontVariables={fontVariables}>
        <MsgBoxProvider>
          <ToastProvider>{children}</ToastProvider>
        </MsgBoxProvider>
      </FontScope>
    </I18nProvider>
  );
}

function FontScope({ children, fontVariables }: FontScopeProps) {
  const { locale } = useI18n();

  return (
    <div
      id="app-font-scope"
      className={cn(
        "h-full font-sans antialiased",
        fontVariables,
        locale === "ar" ? "locale-ar" : "locale-default",
      )}
    >
      {children}
    </div>
  );
}
