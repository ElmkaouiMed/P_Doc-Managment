import { signOutAction } from "@/features/auth/actions";
import { useI18n } from "@/i18n/provider";
import { NotificationCenter } from "./notification-center";
import { UiButton } from "../ui/ui-button";

interface HeaderProps {
  userName: string;
  userEmail: string;
  companyName: string;
}

export function Header({ userName, userEmail, companyName }: HeaderProps) {
  const { t } = useI18n();
  const initials = userName
    .split(" ")
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join("");

  return (
    <header className="flex h-16 items-center justify-between gap-4 rounded-md border border-border bg-card/80 px-4 shadow-sm backdrop-blur-md">
      <div className="hidden text-xs text-muted-foreground lg:block">
        <p className="font-semibold text-foreground">{companyName}</p>
        <p>{t("header.workspaceActive")}</p>
      </div>
      <div className="flex items-center gap-3">
        
        <div className="flex flex-col text-right text-xs text-muted-foreground">
          <p className="text-foreground">{userName}</p>
          <p className="text-primary">{userEmail}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-primary/80 text-xs font-semibold text-primary-foreground shadow-inner">
          {initials || "US"}
        </span>
        <NotificationCenter />
        <form action={signOutAction}>
          <UiButton
            type="submit"
            variant="danger"
            icon="logout"
            iconOnly
            aria-label={t("header.signOut")}
            title={t("header.signOut")}
            className="inline-flex h-8 items-center justify-center rounded-sm border border-border bg-background/60 px-3 text-[11px] font-semibold text-muted-foreground transition hover:border-ring/60 hover:text-foreground"
          />
        </form>
      </div>
    </header>
  );
}
