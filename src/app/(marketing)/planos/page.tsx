import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { LaunchBanner } from "@/components/billing/launch-banner";
import { PricingBoard } from "@/components/billing/pricing-board";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getInitialPriceGrid } from "@/lib/billing/grid";
import { getLaunchLevel } from "@/lib/billing/launch";
import { getCurrentUser } from "@/lib/tenant";

export const metadata = {
  title: "Planos | Voxa3D",
  description: "Escolha o plano do Voxa3D e comece com 7 dias de teste grátis.",
};

export default async function PlanosPage() {
  const [grid, launchLevel, user] = await Promise.all([
    getInitialPriceGrid(),
    getLaunchLevel(),
    getCurrentUser(),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 p-4 py-8 md:p-8">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" aria-label="Voxa3D, página inicial">
          <Logo className="text-2xl" />
        </Link>
        <Link
          href={user ? "/painel" : "/login"}
          className={buttonClasses({ variant: "secondary", size: "sm" })}
        >
          {user ? "Abrir o sistema" : "Entrar"}
        </Link>
      </header>

      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-tinta">Planos do Voxa3D</h1>
        <p className="mx-auto mt-2 max-w-xl text-tinta/70">
          Teste grátis por 7 dias, sem cartão. Depois, escolha o plano e o período que combinam com o
          seu negócio.
        </p>
      </div>

      {grid ? (
        <PricingBoard
          mode="public"
          initialGrid={grid}
          launchLevel={launchLevel}
          banner={<LaunchBanner level={launchLevel} />}
          signedIn={user !== null}
        />
      ) : (
        <Card className="text-center">
          <p className="font-semibold">Não foi possível carregar os planos agora</p>
          <p className="mt-1 text-sm text-tinta/70">Tente de novo em alguns instantes.</p>
        </Card>
      )}
    </main>
  );
}
