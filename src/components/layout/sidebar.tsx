"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { HugIcon } from "@/components/ui/hug-icon";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { primaryNavItems } from "./nav-data";

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <aside className="relative hidden overflow-hidden rounded-md border border-border bg-card/80 transition-all duration-200 lg:flex lg:w-16">
      <div className="relative flex h-full w-full flex-col gap-12 px-2 py-5">
        <Link
          href="/dashboard"
          className="flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold tracking-tight text-foreground transition"
          title="DocV1"
        >
          {/* <span className="flex p-2.5 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            DV
          </span> */}
        </Link>

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
  );
}
