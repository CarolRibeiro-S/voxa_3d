import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { CostSettings, MemberRole, Tenant } from "@/types/database";

// Sempre com o cliente do usuário (RLS). Nunca usar a service role key aqui.

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getCurrentTenant = cache(
  async (): Promise<{ tenant: Tenant; role: MemberRole } | null> => {
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

    return { tenant: tenant as Tenant, role: member.role as MemberRole };
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
