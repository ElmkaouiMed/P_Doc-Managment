import { SettingsTabs } from "@/features/settings/settings-tabs";
import { getServerI18n } from "@/i18n/server";
import { PageEducationBanner } from "@/components/marketing/page-education-banner";

export default async function SettingsPage() {
  const { t } = await getServerI18n();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("settings.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("settings.subtitle")}
        </p>
      </header>

      <PageEducationBanner
        title={t("education.banner.settings.title")}
        description={t("education.banner.settings.description")}
        videoLabel={t("education.banner.common.watchVideo")}
        videoHref="https://www.youtube.com/watch?v=aqz-KE-bpKQ"
        helpLabel={t("education.banner.common.needHelp")}
        supportTitle={t("education.banner.support.title")}
        supportDescription={t("education.banner.support.description")}
        supportCallLabel={t("education.banner.support.call")}
        supportCloseLabel={t("education.banner.support.close")}
        sourceSection="education-settings"
        checklist={[
          t("education.banner.settings.point1"),
          t("education.banner.settings.point2"),
          t("education.banner.settings.point3"),
        ]}
      />

      <SettingsTabs />
    </div>
  );
}
