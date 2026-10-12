import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";
import type { Material, MaterialKind } from "@/types/database";

// Sempre com o cliente do usuário (RLS). Nunca usar a service role key aqui.
export async function getMaterials(
  kind: MaterialKind,
  includeArchived: boolean,
): Promise<Material[]> {
  const current = await getCurrentTenant();
  if (!current) return [];

  const supabase = await createClient();
  let query = supabase
    .from("materials")
    .select("*")
    .eq("tenant_id", current.tenant.id)
    .is("deleted_at", null)
    .eq("kind", kind)
    .order("name");
  if (!includeArchived) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) throw new Error("Não foi possível carregar os materiais.");

  return (data ?? []).map((row) => ({
    id: row.id,
    tenant_id: row.tenant_id,
    kind: row.kind as MaterialKind,
    name: row.name,
    brand: row.brand,
    material_type: row.material_type,
    color: row.color,
    price_brl: Number(row.price_brl),
    package_size: Number(row.package_size),
    cost_per_unit: Number(row.cost_per_unit),
    stock_remaining:
      row.stock_remaining === null ? null : Number(row.stock_remaining),
    is_active: row.is_active,
    deleted_at: row.deleted_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}
