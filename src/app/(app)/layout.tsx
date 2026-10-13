import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Logo } from "@/components/layout/logo";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { Card } from "@/components/ui/card";
import { TourProvider } from "@/components/tour/tour-provider";
import { trialDaysLeft } from "@/lib/billing/labels";
import { getCurrentTenant, getCurrentUser, getMemberStores } from "@/lib/tenant";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // O proxy já redireciona. Esta checagem é a segunda camada de proteção.
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const current = await getCurrentTenant();
  if (!current) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-4">
        <Logo className="text-4xl" />
        <Card className="w-full max-w-sm text-center">
          <p className="mb-6 text-tinta">
            Não encontramos a sua conta. Saia e entre novamente.
          </p>
          <SignOutButton className="w-full" />
        </Card>
      </main>
    );
  }

  // TODO: tratar teste expirado e assinatura cancelada na etapa de cobrança.
  const { access } = current;
  const stores = await getMemberStores();
  return (
    <TourProvider userId={user.id} plan={current.tenant.plan} role={current.role}>
    <AppShell
      plan={current.tenant.plan}
      role={current.role}
      stores={stores}
      activeTenantId={current.tenant.id}
      accessStatus={access.status}
      accessNotice={access.notice}
      trialDaysLeft={access.status === "trialing" ? trialDaysLeft(access.trialEndsAt) : null}
    >
      {children}
    </AppShell>
    </TourProvider>
  );
}
