import { AppShell } from "@/components/layout/app-shell";
import { requireAuthContext } from "@/features/auth/lib/session";
import { redirect } from "next/navigation";
import { isDesktopMode } from "@/lib/runtime";

function calculateDaysLeft(value: Date | null) {
  if (!value) {
    return null;
  }
  const now = Date.now();
  const end = value.getTime();
  return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
}

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await requireAuthContext();
  if (!isDesktopMode() && auth.company.accountStatus === "LOCKED") {
    redirect("/account-suspended");
  }

  return (
    <AppShell
      user={{
        name: auth.user.fullName,
        email: auth.user.email,
        companyName: auth.company.name,
      }}
      account={{
        status: isDesktopMode() ? "ACTIVE_PAID" : auth.company.accountStatus,
        trialEndsAt: isDesktopMode() ? null : auth.company.trialEndsAt?.toISOString() || null,
        graceEndsAt: isDesktopMode() ? null : auth.company.graceEndsAt?.toISOString() || null,
        trialDaysLeft: isDesktopMode() ? null : calculateDaysLeft(auth.company.trialEndsAt),
        graceDaysLeft: isDesktopMode() ? null : calculateDaysLeft(auth.company.graceEndsAt),
      }}
    >
      {children}
    </AppShell>
  );
}
