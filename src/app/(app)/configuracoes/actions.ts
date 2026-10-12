"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { costSettingsSchema, type CostSettingsValues } from "@/lib/cost-settings";
import {
  tenantProfileSchema,
  type TenantProfileInput,
} from "@/lib/tenant-profile-schema";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant, getCurrentUser } from "@/lib/tenant";

export type SaveCostSettingsState =
  | { ok: true; savedAt: number }
  | { ok: false; message: string }
  | null;

const GENERIC_ERROR = "Não foi possível salvar. Tente novamente.";

export async function saveCostSettings(
  _prev: SaveCostSettingsState,
  values: CostSettingsValues,
): Promise<SaveCostSettingsState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sua sessão expirou. Entre novamente." };

  // O tenant vem da sessão, nunca do formulário.
  const current = await getCurrentTenant();
  if (!current) return { ok: false, message: "Não encontramos a sua conta." };

  // A entrada do cliente nunca é confiável: valida de novo no servidor.
  const parsed = costSettingsSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Confira os valores informados.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cost_settings")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("tenant_id", current.tenant.id)
    .select("tenant_id");

  if (error || !data || data.length === 0) {
    return { ok: false, message: GENERIC_ERROR };
  }

  revalidatePath("/configuracoes");
  return { ok: true, savedAt: Date.now() };
}

// ---- Dados do orçamento (topo do PDF) ----

export type SaveTenantProfileState =
  | { ok: true; savedAt: number }
  | { ok: false; message: string };

export async function saveTenantProfile(
  values: TenantProfileInput,
): Promise<SaveTenantProfileState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sua sessão expirou. Entre novamente." };

  // O tenant vem da sessão, nunca do formulário.
  const current = await getCurrentTenant();
  if (!current) return { ok: false, message: "Não encontramos a sua conta." };

  const parsed = tenantProfileSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Confira os valores informados.",
    };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("tenant_profile").upsert(
    {
      tenant_id: current.tenant.id,
      business_name: v.business_name === "" ? null : v.business_name,
      whatsapp: v.whatsapp === "" ? null : v.whatsapp,
      instagram: v.instagram === "" ? null : v.instagram,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" },
  );
  if (error) {
    console.error("Erro ao salvar tenant_profile:", error.code, error.message);
    return { ok: false, message: GENERIC_ERROR };
  }

  revalidatePath("/configuracoes");
  return { ok: true, savedAt: Date.now() };
}

// ---- Simulador de preço (a fórmula fica só no servidor) ----

const simulationInputSchema = z.object({
  baseCost: z.number().finite().min(0).max(999_999.99),
  failurePct: z.number().finite().min(0).lt(90),
  marginPct: z.number().finite().min(0).max(999.99),
  marketplacePct: z.number().finite().min(0).max(999.99),
  paymentPct: z.number().finite().min(0).max(999.99),
  taxPct: z.number().finite().min(0).max(999.99),
});

export type SimulationResult =
  | { ok: true; totalCost: number; price: number; profit: number }
  | { ok: false; message: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function simulatePriceAction(
  input: z.input<typeof simulationInputSchema>,
): Promise<SimulationResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
  const current = await getCurrentTenant();
  if (!current) return { ok: false, message: "Não encontramos a sua conta." };

  const parsed = simulationInputSchema.safeParse(input);
  const adjust = "Ajuste os percentuais para ver o preço";
  if (!parsed.success) return { ok: false, message: adjust };
  const v = parsed.data;

  // Soma em centésimos inteiros, sem erro de ponto flutuante.
  const sumCents = [v.marginPct, v.marketplacePct, v.paymentPct, v.taxPct].reduce(
    (t, n) => t + Math.round(n * 100),
    0,
  );
  if (sumCents >= 10_000) return { ok: false, message: adjust };
  const sumPct = sumCents / 10_000;

  const totalCost = v.baseCost / (1 - v.failurePct / 100);
  const price = totalCost / (1 - sumPct);
  return {
    ok: true,
    totalCost: round2(totalCost),
    price: round2(price),
    profit: round2(price * (v.marginPct / 100)),
  };
}
