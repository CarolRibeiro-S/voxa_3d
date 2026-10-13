import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasFeature } from "@/lib/plans";
import type { ChannelRates } from "@/lib/pricing-core";
import type { Plan } from "@/lib/plans";

export interface LoadedChannels {
  // null quando o plano não tem canais (ou quando a busca falhou, veja `failed`).
  list: ChannelRates[] | null;
  // A busca falhou: diferente de "nenhum canal cadastrado" (lista vazia).
  failed: boolean;
}

// Canais de venda ativos da conta, na ordem do cadastro.
export async function loadChannels(
  supabase: SupabaseClient,
  tenantId: string,
  plan: Plan,
): Promise<LoadedChannels> {
  if (!hasFeature(plan, "channels")) return { list: null, failed: false };

  const { data, error } = await supabase
    .from("sales_channels")
    .select("id, name, commission_pct, payment_pct, tax_pct, fixed_fee_brl")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("position", { ascending: true });
  if (error) {
    // O preço principal não depende dos canais: segue sem a tabela.
    console.error("Erro ao carregar canais de venda:", error.code, error.message);
    return { list: null, failed: true };
  }

  const list = (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    commission_pct: Number(row.commission_pct),
    payment_pct: Number(row.payment_pct),
    tax_pct: Number(row.tax_pct),
    fixed_fee_brl: Number(row.fixed_fee_brl),
  }));
  return { list, failed: false };
}
