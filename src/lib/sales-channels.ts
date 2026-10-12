import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";
import type { SalesChannel } from "@/types/database";

// Dados do próprio tenant (RLS), sem os excluídos.
export async function getSalesChannels(): Promise<SalesChannel[]> {
  const current = await getCurrentTenant();
  if (!current) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_channels")
    .select(
      "id, tenant_id, name, commission_pct, payment_pct, tax_pct, fixed_fee_brl, is_active, position, created_at, updated_at, deleted_at",
    )
    .eq("tenant_id", current.tenant.id)
    .is("deleted_at", null)
    .order("position", { ascending: true });
  if (error) throw new Error("Não foi possível carregar os canais de venda.");

  return (data ?? []).map((row) => ({
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    name: String(row.name),
    commission_pct: Number(row.commission_pct),
    payment_pct: Number(row.payment_pct),
    tax_pct: Number(row.tax_pct),
    fixed_fee_brl: Number(row.fixed_fee_brl),
    is_active: row.is_active === true,
    position: Number(row.position),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    deleted_at: (row.deleted_at as string | null) ?? null,
  }));
}
