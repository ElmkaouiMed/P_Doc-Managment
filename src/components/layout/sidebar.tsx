"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { HugIcon } from "@/components/ui/hug-icon";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { primaryNavItems } from "./nav-data";

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { t, direction } = useI18n();

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const closeMobile = () => {
    onMobileClose?.();
  };

  return (
    <>
      <aside className="relative hidden overflow-hidden rounded-md border border-border bg-card/80 transition-all duration-200 lg:flex lg:w-16">
        <div className="relative flex h-full w-full flex-col gap-12 px-2 py-5">
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold tracking-tight text-foreground transition"
            title="DocV1"
          />

          <nav className="flex flex-1 flex-col items-center gap-2 px-1">
            {primaryNavItems.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex w-full items-center rounded-sm px-3 py-2 text-sm font-semibold transition hover:bg-accent hover:text-accent-foreground",
                    "justify-center gap-0",
                    active ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                  )}
                  aria-label={t(item.labelKey)}
                  title={t(item.labelKey)}
                >
                  <HugIcon icon={item.icon} size={18} className="shrink-0" />
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px] lg:hidden" onClick={closeMobile}>
          <aside
            className={cn(
              "absolute top-1/2 flex h-fit w-16 -translate-y-1/2 items-center justify-center rounded-xl border border-border bg-card/95 p-2 shadow-2xl",
              direction === "ltr" ? "right-3" : "left-3",
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <nav className="flex flex-col items-center justify-center gap-2">
              {primaryNavItems.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobile}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-md text-sm font-semibold transition",
                      active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                    aria-label={t(item.labelKey)}
                    title={t(item.labelKey)}
                  >
                    <HugIcon icon={item.icon} size={18} className="shrink-0" />
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}
