import "server-only";
import type { Plan } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";
import {
  MODEL_BUCKET,
  MODEL_PHOTO_SIGNED_SECONDS,
  type ModelCardData,
  type ModelOption,
  type OrderModelInfo,
} from "@/lib/models-schema";

// Dados do próprio tenant (RLS). Fotos nunca têm URL pública: só URL assinada de 1 hora, gerada
// aqui no servidor, em lote.
//
// models: id, tenant_id, name, source_url, material_hint, default_weight_g, default_print_minutes,
//         print_notes, photo_path, created_by, created_at, updated_at, deleted_at
// plans:  max_models (Pro 100, Loja 500)

const CARD_COLUMNS =
  "id, name, source_url, material_hint, default_weight_g, default_print_minutes, print_notes, photo_path";
// O Operador só recebe estas colunas do modelo.
const ORDER_COLUMNS = "id, name, photo_path, print_notes, material_hint, source_url, deleted_at";

const nullable = (v: unknown) => (v === null || v === undefined ? null : String(v));
const nullableNumber = (v: unknown) => (v === null || v === undefined ? null : Number(v));

// Quantos modelos o plano inclui (plans.max_models). Sem resposta, assume 100 (o menor).
export async function getMaxModels(plan: Plan): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("plans").select("max_models").eq("code", plan).maybeSingle();
  if (error) console.error("Erro ao ler plans.max_models:", error.code, error.message);
  const n = Number(data?.max_models);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 100;
}

export async function countModels(tenantId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("models")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);
  if (error) throw new Error("Não foi possível contar os modelos.");
  return count ?? 0;
}

// URLs assinadas (validade de 1 hora) de várias fotos de uma vez.
export async function signPhotoUrls(paths: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  const urls = new Map<string, string>();
  if (unique.length === 0) return urls;

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(MODEL_BUCKET)
    .createSignedUrls(unique, MODEL_PHOTO_SIGNED_SECONDS);
  if (error) {
    console.error("Erro ao assinar fotos de modelos:", error.message);
    return urls;
  }
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return urls;
}

// Escapa os curingas do ilike para a busca ser literal.
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

// Página Modelos: todos os modelos ativos da loja, por nome.
export async function getModels(): Promise<ModelCardData[]> {
  const current = await getCurrentTenant();
  if (!current) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("models")
    .select(CARD_COLUMNS)
    .eq("tenant_id", current.tenant.id)
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .limit(1000);
  if (error) throw new Error("Não foi possível carregar os modelos.");

  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const urls = await signPhotoUrls(rows.map((r) => nullable(r.photo_path)));
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    photoUrl: r.photo_path ? (urls.get(String(r.photo_path)) ?? null) : null,
    sourceUrl: nullable(r.source_url),
    materialHint: nullable(r.material_hint),
    weightG: nullableNumber(r.default_weight_g),
    printMinutes: nullableNumber(r.default_print_minutes),
    printNotes: nullable(r.print_notes),
  }));
}

// Busca do seletor "Modelo": poucos resultados por vez, com miniatura assinada.
export async function searchModelOptions(query: string): Promise<ModelOption[]> {
  const current = await getCurrentTenant();
  if (!current) return [];

  const supabase = await createClient();
  let request = supabase
    .from("models")
    .select("id, name, photo_path")
    .eq("tenant_id", current.tenant.id)
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .limit(20);
  const text = query.trim().slice(0, 80);
  if (text) request = request.ilike("name", `%${escapeLike(text)}%`);

  const { data, error } = await request;
  if (error) throw new Error("Não foi possível carregar os modelos.");
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const urls = await signPhotoUrls(rows.map((r) => nullable(r.photo_path)));
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    photoUrl: r.photo_path ? (urls.get(String(r.photo_path)) ?? null) : null,
  }));
}

// Modelos usados nos pedidos (inclusive os removidos). Só as colunas permitidas ao Operador.
export async function getOrderModels(ids: string[]): Promise<Record<string, OrderModelInfo>> {
  const current = await getCurrentTenant();
  const unique = [...new Set(ids)];
  if (!current || unique.length === 0) return {};

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("models")
    .select(ORDER_COLUMNS)
    .eq("tenant_id", current.tenant.id)
    .in("id", unique);
  if (error) throw new Error("Não foi possível carregar os modelos dos pedidos.");

  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const urls = await signPhotoUrls(rows.map((r) => nullable(r.photo_path)));
  const result: Record<string, OrderModelInfo> = {};
  for (const r of rows) {
    result[String(r.id)] = {
      id: String(r.id),
      name: String(r.name),
      photoUrl: r.photo_path ? (urls.get(String(r.photo_path)) ?? null) : null,
      materialHint: nullable(r.material_hint),
      printNotes: nullable(r.print_notes),
      sourceUrl: nullable(r.source_url),
      removed: r.deleted_at !== null && r.deleted_at !== undefined,
    };
  }
  return result;
}

// Só os nomes (inclusive de modelos removidos), para listas que não mostram foto.
export async function getModelNames(ids: string[]): Promise<Record<string, string>> {
  const current = await getCurrentTenant();
  const unique = [...new Set(ids)];
  if (!current || unique.length === 0) return {};

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("models")
    .select("id, name")
    .eq("tenant_id", current.tenant.id)
    .in("id", unique);
  if (error) throw new Error("Não foi possível carregar os modelos.");
  return Object.fromEntries((data ?? []).map((r) => [String(r.id), String(r.name)]));
}

// Confere que todos os modelos informados são desta loja e não estão na Lixeira. Devolve a
// mensagem de erro, ou null se estiver tudo certo.
export async function unusableModelMessage(
  tenantId: string,
  ids: (string | null | undefined)[],
): Promise<string | null> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (unique.length === 0) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("models")
    .select("id")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .in("id", unique);
  if (error) return "Não foi possível conferir o modelo. Tente novamente.";
  return (data ?? []).length === unique.length ? null : "Modelo não encontrado.";
}
