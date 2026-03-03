import { cookies } from "next/headers";

import { APP_LOCALE_COOKIE } from "@/i18n/constants";
import { AppLocale, messages, SUPPORTED_LOCALES } from "@/i18n/messages";

function isLocale(input: string): input is AppLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(input);
}

function resolveDirection(locale: AppLocale) {
  return locale === "ar" ? "rtl" : "ltr";
}

export async function getServerLocale(): Promise<AppLocale> {
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
