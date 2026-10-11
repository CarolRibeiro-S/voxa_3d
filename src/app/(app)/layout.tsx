import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Logo } from "@/components/layout/logo";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { Card } from "@/components/ui/card";
import { getCurrentTenant, getCurrentUser } from "@/lib/tenant";

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
  return <AppShell plan={current.tenant.plan}>{children}</AppShell>;
}
