import { AppShell } from "@/components/layout/app-shell";
import { requireAuthContext } from "@/features/auth/lib/session";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await requireAuthContext();

  return (
    <AppShell
      user={{
        name: auth.user.fullName,
        email: auth.user.email,
        companyName: auth.company.name,
      }}
    >
      {children}
    </AppShell>
  );
}
