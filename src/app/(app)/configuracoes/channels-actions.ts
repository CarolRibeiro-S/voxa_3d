"use server";

import { revalidatePath } from "next/cache";
import { hasFeature } from "@/lib/plans";
import {
  MAX_SALES_CHANNELS,
  salesChannelIdSchema,
  salesChannelSchema,
  type SalesChannelInput,
} from "@/lib/sales-channels-schema";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant, getCurrentUser } from "@/lib/tenant";
import type { SalesChannelInsert } from "@/types/database";

export type ChannelActionResult = { ok: true } | { ok: false; message: string };

const GENERIC_ERROR = "Não foi possível salvar. Tente novamente.";
const DUPLICATE_ERROR = "Já existe um canal com esse nome.";
const LIMIT_ERROR = `Você atingiu o limite de ${MAX_SALES_CHANNELS} canais.`;

type Guard = { ok: true; tenantId: string } | { ok: false; message: string };

// Sessão, tenant da sessão (nunca do formulário) e plano com canais de venda.
async function guard(): Promise<Guard> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
  const current = await getCurrentTenant();
  if (!current) return { ok: false, message: "Não encontramos a sua conta." };
  if (!hasFeature(current.tenant.plan, "channels")) {
    return { ok: false, message: "Os canais de venda estão disponíveis nos planos Pro e Loja." };
  }
  return { ok: true, tenantId: current.tenant.id };
}

function fail(context: string, error: { code?: string; message?: string }, message = GENERIC_ERROR) {
  // Registra só o código e a mensagem do erro, sem dados do usuário.
  console.error(`Erro em canais de venda (${context}):`, error.code, error.message);
  return { ok: false, message: error.code === "23505" ? DUPLICATE_ERROR : message } as const;
}

export async function createSalesChannel(values: SalesChannelInput): Promise<ChannelActionResult> {
  const g = await guard();
  if (!g.ok) return g;
  const parsed = salesChannelSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Confira os valores informados." };
  }

  const supabase = await createClient();
  const { data: existing, error: listError } = await supabase
    .from("sales_channels")
    .select("position")
    .eq("tenant_id", g.tenantId)
    .is("deleted_at", null)
    .order("position", { ascending: false });
  if (listError) return fail("contar", listError);
  if ((existing?.length ?? 0) >= MAX_SALES_CHANNELS) return { ok: false, message: LIMIT_ERROR };

  // O novo canal vai para o fim da lista.
  const last = existing?.[0]?.position;
  const row: SalesChannelInsert = {
    tenant_id: g.tenantId,
    ...parsed.data,
    is_active: true,
    position: last === undefined || last === null ? 1 : Number(last) + 1,
  };
  const { error } = await supabase.from("sales_channels").insert(row);
  if (error) return fail("criar", error);

  revalidatePath("/configuracoes");
  return { ok: true };
}

export async function updateSalesChannel(
  id: string,
  values: SalesChannelInput,
): Promise<ChannelActionResult> {
  const g = await guard();
  if (!g.ok) return g;
  if (!salesChannelIdSchema.safeParse(id).success) return { ok: false, message: GENERIC_ERROR };
  const parsed = salesChannelSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Confira os valores informados." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_channels")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", g.tenantId)
    .is("deleted_at", null)
    .select("id");
  if (error || !data || data.length === 0) return fail("editar", error ?? {});

  revalidatePath("/configuracoes");
  return { ok: true };
}

export async function setSalesChannelActive(
  id: string,
  isActive: boolean,
): Promise<ChannelActionResult> {
  const g = await guard();
  if (!g.ok) return g;
  if (!salesChannelIdSchema.safeParse(id).success || typeof isActive !== "boolean") {
    return { ok: false, message: GENERIC_ERROR };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_channels")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", g.tenantId)
    .is("deleted_at", null)
    .select("id");
  if (error || !data || data.length === 0) {
    return fail("situação", error ?? {}, "Não foi possível alterar o canal. Tente novamente.");
  }

  revalidatePath("/configuracoes");
  return { ok: true };
}

// Exclusão é soft delete: o canal vai para a Lixeira e pode ser restaurado em Histórico.
export async function deleteSalesChannel(id: string): Promise<ChannelActionResult> {
  const g = await guard();
  if (!g.ok) return g;
  if (!salesChannelIdSchema.safeParse(id).success) return { ok: false, message: GENERIC_ERROR };

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("sales_channels")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", id)
    .eq("tenant_id", g.tenantId)
    .is("deleted_at", null)
    .select("id");
  if (error || !data || data.length === 0) {
    return fail("excluir", error ?? {}, "Não foi possível excluir. Tente novamente.");
  }

  revalidatePath("/configuracoes");
  return { ok: true };
}
