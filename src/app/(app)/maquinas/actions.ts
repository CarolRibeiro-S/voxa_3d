"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  printerSchema,
  PRINTER_TYPES,
  type CatalogListItem,
  type CatalogPrinterView,
  type PrinterValues,
} from "@/lib/printers-schema";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant, getCurrentUser } from "@/lib/tenant";
import type { TenantPrinterInsert, TenantPrinterUpdate } from "@/types/database";

export type ActionResult = { ok: true } | { ok: false; message: string };

const GENERIC_ERROR = "Não foi possível salvar. Tente novamente.";
const CATALOG_RATE_LIMIT =
  "Muitas consultas ao catálogo agora. Tente novamente em alguns minutos.";
const CATALOG_ERROR = "Não foi possível consultar o catálogo agora. Tente novamente.";
const SESSION_ERROR = "Sua sessão expirou. Entre novamente.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Revalida a sessão e pega o tenant da sessão, nunca do formulário.
async function requireTenant() {
  const user = await getCurrentUser();
  if (!user) return null;
  return getCurrentTenant();
}

const emptyToNull = (value: string) => (value === "" ? null : value);

// ---- Catálogo global: só por RPC, uma consulta pontual por vez ----

// Escolhe a mensagem pelo erro real. Só o limite de consultas vira o aviso de limite.
function catalogErrorMessage(error: { code?: string; message?: string }): string {
  const message = error.message ?? "";
  if (error.code === "P0001" || message.includes("Limite de consultas atingido")) {
    return CATALOG_RATE_LIMIT;
  }
  // Registra só o código e a mensagem do erro, sem dados do usuário.
  console.error("Erro na RPC do catálogo:", error.code, message);
  return CATALOG_ERROR;
}

const listItemSchema = z.object({
  type: z.enum(PRINTER_TYPES),
  brand: z.string(),
  model: z.string(),
});

export async function listCatalogPrinters(): Promise<
  { ok: true; items: CatalogListItem[] } | { ok: false; message: string }
> {
  const current = await requireTenant();
  if (!current) return { ok: false, message: SESSION_ERROR };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("catalog_list_printers");
  if (error) return { ok: false, message: catalogErrorMessage(error) };

  const parsed = z.array(listItemSchema).safeParse(data);
  if (!parsed.success) return { ok: false, message: CATALOG_ERROR };

  // Devolve só tipo, marca e modelo, mesmo que a RPC mande mais campos.
  return {
    ok: true,
    items: parsed.data.map(({ type, brand, model }) => ({ type, brand, model })),
  };
}

const numOrNull = z.number().finite().nullable().optional();
const boolOrNull = z.boolean().nullable().optional();

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const detailSchema = z.object({
  id: z.string().regex(UUID_PATTERN),
  type: z.enum(PRINTER_TYPES),
  brand: z.string(),
  model: z.string(),
  build_x_mm: numOrNull,
  build_y_mm: numOrNull,
  build_z_mm: numOrNull,
  avg_power_w: numOrNull,
  avg_power_basis: z.enum(["fabricante", "medicao", "estimativa"]).nullable().optional(),
  enclosed: boolOrNull,
  hardened_nozzle: boolOrNull,
  multicolor: boolOrNull,
  screen_size_in: numOrNull,
  price_ref_brl: numOrNull,
  price_ref_date: z.string().nullable().optional(),
});

const lookupSchema = z.object({
  brand: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(120),
});

const mm = (n: number) => new Intl.NumberFormat("pt-BR").format(n);

// "2026-03-15" vira "março de 2026" (sem depender de fuso horário).
function monthYear(iso: string | null | undefined): string | null {
  const match = iso?.match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
}

export async function getCatalogPrinter(
  brand: string,
  model: string,
): Promise<
  { ok: true; printer: CatalogPrinterView } | { ok: false; message: string }
> {
  const current = await requireTenant();
  if (!current) return { ok: false, message: SESSION_ERROR };

  const lookup = lookupSchema.safeParse({ brand, model });
  if (!lookup.success) {
    return { ok: false, message: "Não foi possível consultar o catálogo." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("catalog_get_printer", {
    p_brand: lookup.data.brand,
    p_model: lookup.data.model,
  });
  if (error) return { ok: false, message: catalogErrorMessage(error) };
  if (data === null || data === undefined) {
    return { ok: false, message: "Modelo não encontrado no catálogo." };
  }

  const parsed = detailSchema.safeParse(data);
  if (!parsed.success) return { ok: false, message: CATALOG_ERROR };
  const d = parsed.data;

  const hasArea = d.build_x_mm != null && d.build_y_mm != null && d.build_z_mm != null;

  // Só o que a tela precisa. Nada de especificações extras.
  return {
    ok: true,
    printer: {
      catalogId: d.id,
      type: d.type,
      brand: d.brand,
      model: d.model,
      avgPowerW: d.avg_power_w ?? null,
      powerBasis: d.avg_power_basis ?? null,
      priceRefBrl: d.price_ref_brl ?? null,
      priceRefLabel: monthYear(d.price_ref_date),
      enclosed: d.enclosed ?? null,
      hardenedNozzle: d.hardened_nozzle ?? null,
      multicolor: d.multicolor ?? null,
      screenSizeIn: d.screen_size_in ?? null,
      buildArea: hasArea
        ? `${mm(d.build_x_mm!)} x ${mm(d.build_y_mm!)} x ${mm(d.build_z_mm!)} mm`
        : null,
    },
  };
}

// ---- Máquinas do tenant ----

// catalogId só vale na criação, para máquinas escolhidas no catálogo.
export async function savePrinter(
  id: string | null,
  values: PrinterValues,
  catalogId: string | null = null,
): Promise<ActionResult> {
  const current = await requireTenant();
  if (!current) return { ok: false, message: SESSION_ERROR };
  if (id !== null && !UUID.test(id)) return { ok: false, message: GENERIC_ERROR };
  if (catalogId !== null && !UUID.test(catalogId)) {
    return { ok: false, message: GENERIC_ERROR };
  }

  // A entrada do cliente nunca é confiável: valida de novo no servidor.
  const parsed = printerSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Confira os valores informados.",
    };
  }
  const v = parsed.data;

  const fields = {
    type: v.type,
    nickname: emptyToNull(v.nickname),
    brand: v.brand,
    model: v.model,
    power_w: v.power_w,
    price_brl: v.price_brl,
    lifespan_hours: v.lifespan_hours,
    maintenance_brl_per_hour: v.maintenance_brl_per_hour,
    notes: emptyToNull(v.notes),
  };

  const supabase = await createClient();

  if (id === null) {
    // Máquina manual grava catalog_id nulo.
    const row: TenantPrinterInsert = {
      ...fields,
      tenant_id: current.tenant.id,
      catalog_id: catalogId,
      is_active: true,
    };
    const { error } = await supabase.from("tenant_printers").insert(row);
    if (error) return { ok: false, message: GENERIC_ERROR };
  } else {
    // Na edição o catalog_id não muda.
    const patch: TenantPrinterUpdate = {
      ...fields,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("tenant_printers")
      .update(patch)
      .eq("id", id)
      .eq("tenant_id", current.tenant.id)
      .select("id");
    if (error || !data || data.length === 0) {
      return { ok: false, message: GENERIC_ERROR };
    }
  }

  revalidatePath("/maquinas");
  return { ok: true };
}

export async function togglePrinterActive(id: string): Promise<ActionResult> {
  const current = await requireTenant();
  if (!current) return { ok: false, message: SESSION_ERROR };
  if (!UUID.test(id)) return { ok: false, message: GENERIC_ERROR };

  const supabase = await createClient();
  const { data: row, error: readError } = await supabase
    .from("tenant_printers")
    .select("is_active")
    .eq("id", id)
    .eq("tenant_id", current.tenant.id)
    .maybeSingle();
  if (readError || !row) {
    return { ok: false, message: "Não foi possível alterar a máquina. Tente novamente." };
  }

  const patch: TenantPrinterUpdate = {
    is_active: !row.is_active,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("tenant_printers")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", current.tenant.id)
    .select("id");
  if (error || !data || data.length === 0) {
    return { ok: false, message: "Não foi possível alterar a máquina. Tente novamente." };
  }

  revalidatePath("/maquinas");
  return { ok: true };
}

export async function deletePrinter(id: string): Promise<ActionResult> {
  const current = await requireTenant();
  if (!current) return { ok: false, message: SESSION_ERROR };
  if (!UUID.test(id)) return { ok: false, message: GENERIC_ERROR };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant_printers")
    .delete()
    .eq("id", id)
    .eq("tenant_id", current.tenant.id)
    .select("id");
  if (error || !data || data.length === 0) {
    return { ok: false, message: "Não foi possível excluir. Tente novamente." };
  }

  revalidatePath("/maquinas");
  return { ok: true };
}
