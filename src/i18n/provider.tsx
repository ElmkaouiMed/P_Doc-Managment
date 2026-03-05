"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { APP_LOCALE_COOKIE } from "@/i18n/constants";
import { AppLocale, messages, SUPPORTED_LOCALES } from "@/i18n/messages";

type I18nContextValue = {
  locale: AppLocale;
  direction: "ltr" | "rtl";
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function isLocale(input: string): input is AppLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(input);
}

function resolveDirection(locale: AppLocale) {
  return locale === "ar" ? "rtl" : "ltr";
}

function readLocaleFromCookie(): AppLocale | null {
  if (typeof document === "undefined") {
    return null;
  }
  const prefix = `${APP_LOCALE_COOKIE}=`;
  const raw = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  if (!raw) {
    return null;
  }
  const value = raw.slice(prefix.length);
  return isLocale(value) ? value : null;
}

type I18nProviderProps = {
  children: React.ReactNode;
  initialLocale?: AppLocale;
};

export function I18nProvider({ children, initialLocale = "fr" }: I18nProviderProps) {
  const [locale, setLocale] = useState<AppLocale>(initialLocale);

  useEffect(() => {
    const apply = () => {
      const fromCookie = readLocaleFromCookie();
      setLocale(fromCookie || initialLocale);
    };
    apply();
    window.addEventListener("doc-v1-general-info-updated", apply);
    return () => window.removeEventListener("doc-v1-general-info-updated", apply);
  }, [initialLocale]);

  useEffect(() => {
    const direction = resolveDirection(locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
    document.documentElement.setAttribute("data-app-locale", locale);
    document.cookie = `${APP_LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => {
    return {
      locale,
      direction: resolveDirection(locale),
      t: (key) => messages[locale][key] || messages.fr[key] || key,
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider.");
  }
  return context;
}
