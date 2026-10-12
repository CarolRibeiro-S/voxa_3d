import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";
import type { PrinterType, TenantPrinter } from "@/types/database";

// Dados do próprio tenant (RLS). Nunca usar a service role key aqui.
export async function getPrinters(): Promise<TenantPrinter[]> {
  const current = await getCurrentTenant();
  if (!current) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant_printers")
    .select("*")
    .eq("tenant_id", current.tenant.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Não foi possível carregar as máquinas.");

  const toNumber = (v: unknown) => (v === null || v === undefined ? null : Number(v));

  return (data ?? []).map((row) => ({
    id: row.id,
    tenant_id: row.tenant_id,
    catalog_id: row.catalog_id,
    nickname: row.nickname,
    type: row.type as PrinterType,
    brand: row.brand,
    model: row.model,
    power_w: toNumber(row.power_w),
    price_brl: toNumber(row.price_brl),
    lifespan_hours: toNumber(row.lifespan_hours),
    maintenance_brl_per_hour: Number(row.maintenance_brl_per_hour ?? 0),
    notes: row.notes,
    is_active: row.is_active,
    deleted_at: row.deleted_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}
