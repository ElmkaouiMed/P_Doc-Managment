import { Moon02Icon, Sun02Icon } from "@hugeicons/core-free-icons";
import { useEffect, useSyncExternalStore } from "react";

import { signOutAction } from "@/features/auth/actions";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { NotificationCenter } from "./notification-center";
import { UiButton } from "../ui/ui-button";

interface HeaderProps {
  userName: string;
  userEmail: string;
  companyName: string;
  onToggleSidebar: () => void;
}

const THEME_UPDATED_EVENT = "doc-v1-theme-updated";

function readThemeSnapshot(): "light" | "dark" {
  if (typeof document === "undefined") {
    return "light";
  }
  const root = document.documentElement;
  const saved = window.localStorage.getItem("doc-v1-theme");
  return saved === "dark" || root.classList.contains("dark") ? "dark" : "light";
}

function subscribeTheme(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }
  const onChange = () => onStoreChange();
  window.addEventListener("storage", onChange);
  window.addEventListener(THEME_UPDATED_EVENT, onChange as EventListener);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(THEME_UPDATED_EVENT, onChange as EventListener);
  };
}

export function Header({ userName, userEmail, companyName, onToggleSidebar }: HeaderProps) {
  const { t, direction } = useI18n();
  const theme = useSyncExternalStore(subscribeTheme, readThemeSnapshot, () => "light");
  const initials = userName
    .split(" ")
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join("");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    window.localStorage.setItem("doc-v1-theme", nextTheme);
    window.dispatchEvent(new Event(THEME_UPDATED_EVENT));
  };

  return (
    <header className="relative flex h-16 items-center justify-between gap-4 rounded-md border border-border bg-card/80 px-4 shadow-sm backdrop-blur-md">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="hidden lg:block">
          <p className="font-semibold text-foreground">{companyName}</p>
          <p>{t("header.workspaceActive")}</p>
        </div>
        <p className="truncate font-semibold text-foreground lg:hidden">{companyName}</p>
      </div>
      <div className={cn("flex items-center gap-3", direction === "ltr" ? "pr-12 lg:pr-0" : "pl-12 lg:pl-0")}>
        
        <div className="hidden flex-col text-right text-xs text-muted-foreground sm:flex">
          <p className="text-foreground">{userName}</p>
          <p className="text-primary">{userEmail}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-primary/80 text-xs font-semibold text-primary-foreground shadow-inner">
          {initials || "US"}
        </span>
        <UiButton
          type="button"
          size="md"
          variant="outline"
          iconOnly
          icon={theme === "dark" ? Sun02Icon : Moon02Icon}
          onClick={toggleTheme}
          aria-label={theme === "dark" ? t("header.themeLight") : t("header.themeDark")}
          title={theme === "dark" ? t("header.themeLight") : t("header.themeDark")}
          className="h-8 w-8 rounded-sm"
        />
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
      <UiButton
        type="button"
        size="md"
        variant="outline"
        iconOnly
        iconName="menu"
        onClick={onToggleSidebar}
        aria-label="Open menu"
        title="Open menu"
        className={cn("absolute top-1/2 -translate-y-1/2 lg:hidden", direction === "ltr" ? "right-4" : "left-4")}
      />
    </header>
  );
}
