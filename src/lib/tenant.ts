import { cache } from "react";
import { resolveAccess, type Access } from "@/lib/billing/access";
import { createClient } from "@/lib/supabase/server";
import type { CostSettings, MemberRole, Tenant, TenantProfile } from "@/types/database";

// Sempre com o cliente do usuário (RLS). A service role key só é usada por src/lib/billing,
// para criar a assinatura de teste.

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getCurrentTenant = cache(
  async (): Promise<{ tenant: Tenant; role: MemberRole; access: Access } | null> => {
    const user = await getCurrentUser();
    if (!user) return null;

    const supabase = await createClient();
    const { data: member } = await supabase
      .from("tenant_members")
      .select("role, tenant_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!member) return null;

    const { data: tenant } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", member.tenant_id)
      .maybeSingle();
    if (!tenant) return null;

    // O plano efetivo vem da assinatura (teste de 7 dias ou plano contratado), não da coluna antiga.
    const access = await resolveAccess(supabase, tenant as Tenant);
    return {
      tenant: { ...(tenant as Tenant), plan: access.plan },
      role: member.role as MemberRole,
      access,
    };
  },
);

export async function getCostSettings(
  tenantId: string,
): Promise<CostSettings | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cost_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) return null;

  return {
    tenant_id: data.tenant_id,
    energy_kwh_brl: Number(data.energy_kwh_brl),
    energy_distributor_id: (data.energy_distributor_id as string | null) ?? null,
    energy_tariff_group: (data.energy_tariff_group as "B1" | "B3" | null) ?? null,
    labor_hour_brl: Number(data.labor_hour_brl),
    failure_rate_pct: Number(data.failure_rate_pct),
    default_margin_pct: Number(data.default_margin_pct),
    marketplace_fee_pct: Number(data.marketplace_fee_pct),
    payment_fee_pct: Number(data.payment_fee_pct),
    tax_pct: Number(data.tax_pct),
    packaging_default_brl: Number(data.packaging_default_brl),
    updated_at: data.updated_at,
  };
}

export async function getTenantProfile(tenantId: string): Promise<TenantProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_profile")
    .select("tenant_id, business_name, whatsapp, instagram, updated_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return (data as TenantProfile | null) ?? null;
}
