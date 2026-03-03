import { arMessages } from "@/i18n/messages/ar";
import { enMessages } from "@/i18n/messages/en";
import { frMessages } from "@/i18n/messages/fr";

export const SUPPORTED_LOCALES = ["fr", "en", "ar"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

type Messages = Record<string, string>;

export const messages: Record<AppLocale, Messages> = {
  fr: frMessages,
  en: enMessages,
  ar: arMessages,
};

export type MessageKey = keyof (typeof messages)["fr"];
