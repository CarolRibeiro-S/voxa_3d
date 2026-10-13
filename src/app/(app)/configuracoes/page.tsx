import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ACCESS_STATUS_LABEL, trialDaysLeft } from "@/lib/billing/labels";
import { formatDate } from "@/lib/format";
import { hasFeature, PLAN_NAMES } from "@/lib/plans";
import { getSalesChannels } from "@/lib/sales-channels";
import { getCostSettings, getCurrentTenant, getTenantProfile } from "@/lib/tenant";
import { CostSettingsForm } from "./cost-settings-form";
import { AutoTour } from "@/components/tour/tour-provider";
import { SalesChannelsCard } from "./sales-channels-card";
import { TenantProfileForm } from "./tenant-profile-form";
import { guardPage } from "@/lib/permissions-server";

export const metadata = { title: "Configurações | Voxa3D" };

export default async function ConfiguracoesPage() {
  const current = await getCurrentTenant();
  if (!current) return null; // O layout já mostra o erro de conta.
  guardPage(current.role, "view_settings");

  const { tenant } = current;
  const canChannels = hasFeature(tenant.plan, "channels");
  const [settings, profile, channels] = await Promise.all([
    getCostSettings(tenant.id),
    getTenantProfile(tenant.id),
    canChannels ? getSalesChannels() : Promise.resolve([]),
  ]);

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
              <Badge>{PLAN_NAMES[tenant.plan]}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-tinta/60">Status</dt>
            <dd className="font-semibold">{ACCESS_STATUS_LABEL[current.access.status]}</dd>
          </div>
          {current.access.status === "trialing" && current.access.trialEndsAt && (
            <div>
              <dt className="text-xs text-tinta/60">Fim do teste</dt>
              <dd className="font-semibold">
                {formatDate(current.access.trialEndsAt)} (
                {trialDaysLeft(current.access.trialEndsAt)} dias)
              </dd>
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

      <TenantProfileForm
        initial={{
          business_name: profile?.business_name ?? tenant.name,
          whatsapp: profile?.whatsapp ?? "",
          instagram: profile?.instagram ?? "",
        }}
      />

      <SalesChannelsCard
        channels={channels}
        defaults={{
          payment_pct: settings?.payment_fee_pct ?? 0,
          tax_pct: settings?.tax_pct ?? 0,
        }}
        locked={!canChannels}
      />
      <AutoTour id="configuracoes" />
    </div>
  );
}
