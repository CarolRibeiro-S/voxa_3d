import { cookies } from "next/headers";
import { cache } from "react";
import { resolveAccess, type Access } from "@/lib/billing/access";
import { createClient } from "@/lib/supabase/server";
import { capabilitiesOf, normalizeRole, type Capability, type Role } from "@/lib/permissions";
import type { CostSettings, Tenant, TenantProfile } from "@/types/database";

// Sempre com o cliente do usuário (RLS). A service role key só é usada por src/lib/billing,
// para criar a assinatura de teste.

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// Cookie da loja ativa (httpOnly). Ele só diz QUAL loja a pessoa quer ver: a cada requisição o
// servidor confere que ela é membro dessa loja.
export const ACTIVE_TENANT_COOKIE = "voxa_tenant";

export interface Membership {
  tenantId: string;
  role: Role;
}

// Lojas das quais a pessoa participa, da mais antiga para a mais nova.
async function loadMemberships(userId: string): Promise<Membership[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_members")
    .select("tenant_id, role, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((m) => ({ tenantId: String(m.tenant_id), role: normalizeRole(m.role) }));
}

// Como a loja ativa é escolhida: (1) a do cookie, se a pessoa for membro dela; (2) a loja onde
// ela é Dono; (3) a primeira. Antes, a consulta pegava "a primeira linha qualquer" de
// tenant_members, sem ordem, o que não servia para quem participa de mais de uma loja.
export const getCurrentTenant = cache(
  async (): Promise<{
    tenant: Tenant;
    role: Role;
    capabilities: Capability[];
    access: Access;
  } | null> => {
    const user = await getCurrentUser();
    if (!user) return null;

    const memberships = await loadMemberships(user.id);
    if (memberships.length === 0) return null;

    const wanted = (await cookies()).get(ACTIVE_TENANT_COOKIE)?.value;
    const chosen =
      memberships.find((m) => m.tenantId === wanted) ??
      memberships.find((m) => m.role === "owner") ??
      memberships[0];

    const supabase = await createClient();
    const { data: tenant } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", chosen.tenantId)
      .maybeSingle();
    if (!tenant) return null;

    // O plano efetivo vem da assinatura (teste de 7 dias ou plano contratado), não da coluna antiga.
    const access = await resolveAccess(supabase, tenant as Tenant);
    return {
      tenant: { ...(tenant as Tenant), plan: access.plan },
      role: chosen.role,
      capabilities: capabilitiesOf(chosen.role),
      access,
    };
  },
);

// Lojas da pessoa, com nome e função, para o seletor "Trocar de loja".
export const getMemberStores = cache(
  async (): Promise<{ tenantId: string; name: string; role: Role }[]> => {
    const user = await getCurrentUser();
    if (!user) return [];
    const memberships = await loadMemberships(user.id);
    if (memberships.length < 2) return [];

    const supabase = await createClient();
    const { data } = await supabase
      .from("tenants")
      .select("id, name")
      .in(
        "id",
        memberships.map((m) => m.tenantId),
      );
    const names = new Map((data ?? []).map((t) => [String(t.id), String(t.name)]));
    return memberships.map((m) => ({
      tenantId: m.tenantId,
      name: names.get(m.tenantId) ?? "Loja",
      role: m.role,
    }));
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
