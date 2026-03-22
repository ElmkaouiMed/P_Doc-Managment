"use client";

import { useEffect, useState } from "react";

import { AccountStatusBanner } from "@/components/layout/account-status-banner";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

type CompanyAccountStatus =
  | "TRIAL_ACTIVE"
  | "TRIAL_EXPIRED"
  | "GRACE"
  | "AWAITING_ACTIVATION"
  | "ACTIVE_PAID"
  | "LOCKED";

interface AppShellProps {
  children: React.ReactNode;
  user: {
    name: string;
    email: string;
    companyName: string;
  };
  account: {
    status: CompanyAccountStatus;
    trialEndsAt: string | null;
    graceEndsAt: string | null;
    trialDaysLeft: number | null;
    graceDaysLeft: number | null;
  };
}

export function AppShell({ children, user, account }: AppShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!mobileSidebarOpen) {
      return;
    }
    const onResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileSidebarOpen(false);
      }
    };
    window.addEventListener("resize", onResize);
    onResize();
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [mobileSidebarOpen]);

  return (
    <div className="flex h-screen flex-col gap-3 bg-background text-foreground">
      <div className="flex h-screen flex-1 gap-3 rounded-xl border border-border bg-card/70 p-3 backdrop-blur-xl lg:p-4">
        <Sidebar mobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)} />
        <div className="flex flex-1 flex-col gap-3">
          <Header
            userName={user.name}
            userEmail={user.email}
            companyName={user.companyName}
            onToggleSidebar={() => setMobileSidebarOpen((current) => !current)}
          />
          <AccountStatusBanner
            state={{
              accountStatus: account.status,
              trialEndsAt: account.trialEndsAt,
              graceEndsAt: account.graceEndsAt,
              trialDaysLeft: account.trialDaysLeft,
              graceDaysLeft: account.graceDaysLeft,
            }}
          />
          <main className="flex-1 overflow-y-auto rounded-md border border-border bg-card/80 p-4 shadow-inner">
            <div className="mx-auto w-full max-w-7xl space-y-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
