import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { daysUntil, formatDate } from "@/lib/format";
import { PLANS } from "@/lib/plans";
import { getCostSettings, getCurrentTenant } from "@/lib/tenant";
import type { SubscriptionStatus } from "@/types/database";
import { CostSettingsForm } from "./cost-settings-form";

export const metadata = { title: "Configurações | Voxa3D" };

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: "Em teste",
  active: "Ativa",
  past_due: "Pagamento pendente",
  canceled: "Cancelada",
};

function trialText(trialEndsAt: string) {
  const days = daysUntil(trialEndsAt);
  const remaining =
    days <= 0
      ? "Teste encerrado"
      : days === 1
        ? "Falta 1 dia"
        : `Faltam ${days} dias`;
  return `${formatDate(trialEndsAt)} (${remaining})`;
}

export default async function ConfiguracoesPage() {
  const current = await getCurrentTenant();
  if (!current) return null; // O layout já mostra o erro de conta.

  const { tenant } = current;
  const settings = await getCostSettings(tenant.id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-extrabold text-tinta">Configurações</h1>

      <Card>
        <h2 className="text-lg font-extrabold">Sua conta</h2>
        <dl className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <dt className="text-xs text-tinta/60">Nome da conta</dt>
            <dd className="font-semibold">{tenant.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-tinta/60">Plano</dt>
            <dd className="mt-0.5">
              <Badge>{PLANS[tenant.plan]?.name ?? tenant.plan}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-tinta/60">Status</dt>
            <dd className="font-semibold">
              {STATUS_LABELS[tenant.subscription_status] ??
                tenant.subscription_status}
            </dd>
          </div>
          {tenant.subscription_status === "trialing" && tenant.trial_ends_at && (
            <div>
              <dt className="text-xs text-tinta/60">Fim do teste</dt>
              <dd className="font-semibold">{trialText(tenant.trial_ends_at)}</dd>
            </div>
          )}
        </dl>
      </Card>

      {settings ? (
        <CostSettingsForm settings={settings} />
      ) : (
        <Card>
          <p className="text-sm text-tinta/70">
            Não encontramos as configurações de custo da sua conta.
          </p>
        </Card>
      )}
    </div>
  );
}
