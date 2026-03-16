"use client";

import { useEffect, useState } from "react";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

interface AppShellProps {
  children: React.ReactNode;
  user: {
    name: string;
    email: string;
    companyName: string;
  };
}

export function AppShell({ children, user }: AppShellProps) {
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
          <main className="flex-1 overflow-y-auto rounded-md border border-border bg-card/80 p-4 shadow-inner">
            <div className="mx-auto w-full max-w-7xl space-y-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
