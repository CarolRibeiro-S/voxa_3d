import { LaunchBanner } from "@/components/billing/launch-banner";
import { PricingBoard } from "@/components/billing/pricing-board";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ACCESS_STATUS_LABEL, daysLeftText, trialDaysLeft } from "@/lib/billing/labels";
import { getInitialPriceGrid } from "@/lib/billing/grid";
import { getLaunchLevel } from "@/lib/billing/launch";
import { formatDate } from "@/lib/format";
import { PLAN_NAMES } from "@/lib/plans";
import { getCurrentTenant } from "@/lib/tenant";
import { guardPage } from "@/lib/permissions-server";

export const metadata = { title: "Assinatura | Voxa3D" };

export default async function AssinaturaPage() {
  const current = await getCurrentTenant();
  if (!current) return null; // O layout já mostra o erro de conta.
  guardPage(current.role, "view_subscription");
  const { access } = current;

  const [grid, launchLevel] = await Promise.all([getInitialPriceGrid(), getLaunchLevel()]);
  const days = access.status === "trialing" ? trialDaysLeft(access.trialEndsAt) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-tinta">Assinatura</h1>
        <p className="mt-1 text-sm text-tinta/70">Veja o estado da sua conta e escolha o plano.</p>
      </div>

      <Card>
        <h2 className="text-sm font-bold uppercase tracking-wide text-violeta-escuro">
          Sua situação
        </h2>
        <dl className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <dt className="text-xs text-tinta/60">Situação</dt>
            <dd className="mt-0.5">
              <Badge variant={access.status === "readonly" ? "warning" : "default"}>
                {ACCESS_STATUS_LABEL[access.status]}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-tinta/60">Plano</dt>
            <dd className="font-semibold">{PLAN_NAMES[access.plan]}</dd>
          </div>
          {access.status !== "active" && access.trialEndsAt && (
            <div>
              <dt className="text-xs text-tinta/60">
                {access.status === "trialing" ? "Fim do teste" : "Teste encerrado em"}
              </dt>
              <dd className="font-semibold">{formatDate(access.trialEndsAt)}</dd>
            </div>
          )}
        </dl>
        {days !== null && <p className="mt-4 text-sm font-medium">{daysLeftText(days)}</p>}
        {access.status === "readonly" && (
          <p className="mt-4 rounded-xl bg-nevoa p-4 text-sm text-violeta-escuro">
            {access.message} Você continua vendo todos os seus dados e nada foi apagado.
          </p>
        )}
        {access.source === "fallback" && (
          <p className="mt-4 text-xs text-tinta/60">
            Não foi possível confirmar sua assinatura agora. Seus dados continuam disponíveis.
          </p>
        )}
      </Card>

      {grid ? (
        <PricingBoard
          mode="account"
          initialGrid={grid}
          launchLevel={launchLevel}
          banner={<LaunchBanner level={launchLevel} />}
          signedIn
          currentPlan={access.plan}
        />
      ) : (
        <Card className="text-center">
          <p className="font-semibold">Não foi possível carregar os planos agora</p>
          <p className="mt-1 text-sm text-tinta/70">Tente de novo em alguns instantes.</p>
        </Card>
      )}
    </div>
  );
}
