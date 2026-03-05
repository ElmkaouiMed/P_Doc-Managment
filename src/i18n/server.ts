import { cookies } from "next/headers";

import { getAuthContext } from "@/features/auth/lib/session";
import { prisma } from "@/lib/db";
import { APP_LOCALE_COOKIE, APP_LOCALE_SETTING_KEY } from "@/i18n/constants";
import { AppLocale, messages, SUPPORTED_LOCALES } from "@/i18n/messages";

function isLocale(input: string): input is AppLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(input);
}

function resolveDirection(locale: AppLocale) {
  return locale === "ar" ? "rtl" : "ltr";
}

function resolveLocaleFromSetting(valueJson: unknown): AppLocale | null {
  if (typeof valueJson === "string" && isLocale(valueJson)) {
    return valueJson;
  }
  if (valueJson && typeof valueJson === "object" && !Array.isArray(valueJson)) {
    const language = (valueJson as Record<string, unknown>).language;
    if (typeof language === "string" && isLocale(language)) {
      return language;
    }
  }
  return null;
}

async function getLocaleFromCompany(companyId: string): Promise<AppLocale | null> {
  const row = await prisma.companySetting
    .findUnique({
      where: {
        companyId_key: {
          companyId,
          key: APP_LOCALE_SETTING_KEY,
        },
      },
      select: {
        valueJson: true,
      },
    })
    .catch(() => null);
  if (!row) {
    return null;
  }
  return resolveLocaleFromSetting(row.valueJson);
}

export async function getServerLocale(): Promise<AppLocale> {
  const auth = await getAuthContext();
  if (auth) {
    const localeFromDb = await getLocaleFromCompany(auth.company.id);
    if (localeFromDb) {
      return localeFromDb;
    }
  }

  const cookieStore = await cookies();
  const value = cookieStore.get(APP_LOCALE_COOKIE)?.value;
  if (value && isLocale(value)) {
    return value;
  }
  return "fr";
}

export async function getServerI18n() {
  const locale = await getServerLocale();
  return {
    locale,
    direction: resolveDirection(locale),
    t: (key: string) => messages[locale][key] || messages.fr[key] || key,
  };
}
