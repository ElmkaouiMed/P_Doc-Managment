"use client";

import { SettingsTabs } from "@/features/settings/settings-tabs";
import { useI18n } from "@/i18n/provider";

export default function SettingsPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("settings.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("settings.subtitle")}
        </p>
      </header>

      <SettingsTabs />
    </div>
  );
}
