"use server";

import { revalidatePath } from "next/cache";
import { materialSchema, type MaterialValues } from "@/lib/materials-schema";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant, getCurrentUser } from "@/lib/tenant";

export type ActionResult = { ok: true } | { ok: false; message: string };

const GENERIC_ERROR = "Não foi possível salvar. Tente novamente.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Revalida a sessão e pega o tenant da sessão, nunca do formulário.
async function requireTenant() {
  const user = await getCurrentUser();
  if (!user) return null;
  return getCurrentTenant();
}

const emptyToNull = (value: string) => (value === "" ? null : value);

export async function saveMaterial(
  id: string | null,
  values: MaterialValues,
): Promise<ActionResult> {
  const current = await requireTenant();
  if (!current) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
  if (id !== null && !UUID.test(id)) return { ok: false, message: GENERIC_ERROR };

  // A entrada do cliente nunca é confiável: valida de novo no servidor.
  const parsed = materialSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Confira os valores informados.",
    };
  }
  const v = parsed.data;

  // cost_per_unit é coluna gerada: nunca enviar.
  const fields = {
    name: v.name,
    brand: emptyToNull(v.brand),
    material_type: emptyToNull(v.material_type),
    color: emptyToNull(v.color),
    price_brl: v.price_brl,
    package_size: v.package_size,
    stock_remaining: v.stock_remaining,
  };

  const supabase = await createClient();

  if (id === null) {
    const { error } = await supabase.from("materials").insert({
      ...fields,
      tenant_id: current.tenant.id,
      kind: v.kind,
      is_active: true,
    });
    if (error) return { ok: false, message: GENERIC_ERROR };
  } else {
    // O tipo (kind) não muda na edição.
    const { data, error } = await supabase
      .from("materials")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", current.tenant.id)
      .select("id");
    if (error || !data || data.length === 0) {
      return { ok: false, message: GENERIC_ERROR };
    }
  }

  revalidatePath("/materiais");
  return { ok: true };
}

// Arquivar e restaurar (soft delete). Não há exclusão definitiva.
export async function setMaterialActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const current = await requireTenant();
  if (!current) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
  if (!UUID.test(id)) return { ok: false, message: GENERIC_ERROR };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("materials")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", current.tenant.id)
    .select("id");

  if (error || !data || data.length === 0) {
    return {
      ok: false,
      message: isActive
        ? "Não foi possível restaurar. Tente novamente."
        : "Não foi possível arquivar. Tente novamente.",
    };
  }

  revalidatePath("/materiais");
  return { ok: true };
}
