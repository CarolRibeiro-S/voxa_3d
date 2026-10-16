"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { writeBlockedMessage } from "@/lib/billing/guard";
import {
  countModels,
  getMaxModels,
  searchModelOptions,
} from "@/lib/models-data";
import {
  MODEL_BUCKET,
  MODEL_NAME_ERROR,
  MODEL_PHOTO_MAX_BYTES,
  modelFormSchema,
  toTotalMinutes,
  type ModelFormValues,
  type ModelOption,
} from "@/lib/models-schema";
import { capabilityDenied } from "@/lib/permissions-server";
import type { Capability } from "@/lib/permissions";
import { uuidSchema } from "@/lib/quotes-schema";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant, getCurrentUser } from "@/lib/tenant";

// "upgrade" avisa a tela de que o limite do plano Pro foi atingido (mostra o link para /assinatura).
export type ModelActionResult = { ok: true } | { ok: false; message: string; upgrade?: boolean };

const GENERIC_ERROR = "Não foi possível salvar. Tente novamente.";
const FIRST_ISSUE = "Confira os valores informados.";
const emptyToNull = (v: string) => (v === "" ? null : v);

type Guard =
  | { ok: true; tenantId: string; userId: string; plan: string }
  | { ok: false; message: string };

// Sessão, tenant da sessão (nunca do navegador), permissão da função e conta fora do modo leitura.
async function guard(capability: Capability, write = true): Promise<Guard> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
  const current = await getCurrentTenant();
  if (!current) return { ok: false, message: "Não encontramos a sua conta." };
  // Permissão da função (Dono, Gerente ou Operador), conferida no servidor.
  const denied = await capabilityDenied(capability);
  if (denied) return { ok: false, message: denied };
  if (write) {
    // Teste vencido sem assinatura: modo leitura, nada é criado nem editado.
    const blocked = await writeBlockedMessage();
    if (blocked) return { ok: false, message: blocked };
  }
  return { ok: true, tenantId: current.tenant.id, userId: user.id, plan: current.tenant.plan };
}

function fail(context: string, error: { code?: string; message?: string }, message = GENERIC_ERROR) {
  // Registra só o código e a mensagem do erro, sem dados do usuário.
  console.error(`Erro em modelos (${context}):`, error.code, error.message);
  return { ok: false, message } as const;
}

function revalidateModels() {
  revalidatePath("/modelos");
  // Os cartões e o painel dos pedidos mostram foto e nome do modelo.
  revalidatePath("/pedidos");
}

function fieldsOf(v: ModelFormValues) {
  return {
    name: v.name,
    source_url: emptyToNull(v.source_url),
    material_hint: emptyToNull(v.material_hint),
    default_weight_g: v.weight_g,
    default_print_minutes: toTotalMinutes(v.hours, v.minutes),
    print_notes: emptyToNull(v.print_notes),
  };
}

// ---- Criar ----

export async function createModel(
  values: ModelFormValues,
): Promise<{ ok: true; id: string } | { ok: false; message: string; upgrade?: boolean }> {
  const g = await guard("manage_models");
  if (!g.ok) return g;
  const parsed = modelFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? FIRST_ISSUE };
  }

  // Limite do plano (plans.max_models), com os modelos fora da Lixeira.
  const current = await getCurrentTenant();
  if (!current) return { ok: false, message: "Não encontramos a sua conta." };
  const [max, used] = await Promise.all([getMaxModels(current.tenant.plan), countModels(g.tenantId)]);
  if (used >= max) {
    return {
      ok: false,
      message: `Seu plano permite até ${max} modelos.`,
      upgrade: current.tenant.plan === "pro",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("models")
    .insert({ ...fieldsOf(parsed.data), tenant_id: g.tenantId, created_by: g.userId })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "23505") return { ok: false, message: MODEL_NAME_ERROR };
    return fail("criar", error ?? {});
  }

  revalidateModels();
  return { ok: true, id: String(data.id) };
}

// ---- Editar ----

export async function updateModel(id: string, values: ModelFormValues): Promise<ModelActionResult> {
  const g = await guard("manage_models");
  if (!g.ok) return g;
  if (!uuidSchema.safeParse(id).success) return { ok: false, message: GENERIC_ERROR };
  const parsed = modelFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? FIRST_ISSUE };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("models")
    .update({ ...fieldsOf(parsed.data), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", g.tenantId)
    .is("deleted_at", null)
    .select("id");
  if (error) {
    if (error.code === "23505") return { ok: false, message: MODEL_NAME_ERROR };
    return fail("editar", error);
  }
  if (!data || data.length === 0) return { ok: false, message: GENERIC_ERROR };

  revalidateModels();
  return { ok: true };
}

// ---- Remover (Lixeira) ----

export async function removeModel(id: string): Promise<ModelActionResult> {
  const g = await guard("manage_models");
  if (!g.ok) return g;
  if (!uuidSchema.safeParse(id).success) return { ok: false, message: GENERIC_ERROR };

  // Soft delete: o modelo vai para a Lixeira e pode ser restaurado em Histórico. Os pedidos
  // antigos continuam mostrando o modelo, com o selo "removido".
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("models")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", id)
    .eq("tenant_id", g.tenantId)
    .is("deleted_at", null)
    .select("id");
  if (error || !data || data.length === 0) {
    return fail("remover", error ?? {}, "Não foi possível remover. Tente novamente.");
  }

  revalidateModels();
  return { ok: true };
}

// ---- Foto ----

// Tipo real da imagem pelos primeiros bytes. Nunca confia no nome nem no content-type.
function sniffImage(bytes: Uint8Array): { contentType: string; ext: string } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", ext: "jpg" };
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) {
    return { contentType: "image/png", ext: "png" };
  }
  // WebP: "RIFF" + 4 bytes de tamanho + "WEBP".
  const ascii = (from: number, text: string) =>
    bytes.length >= from + text.length && [...text].every((c, i) => bytes[from + i] === c.charCodeAt(0));
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return { contentType: "image/webp", ext: "webp" };
  return null;
}

export async function uploadModelPhoto(modelId: string, formData: FormData): Promise<ModelActionResult> {
  const g = await guard("manage_models");
  if (!g.ok) return g;
  if (!uuidSchema.safeParse(modelId).success) return { ok: false, message: GENERIC_ERROR };

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Escolha uma foto." };
  }
  if (file.size > MODEL_PHOTO_MAX_BYTES) {
    return { ok: false, message: "A foto deve ter no máximo 2 MB." };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) return { ok: false, message: "Use uma foto em JPEG, PNG ou WebP." };

  const supabase = await createClient();
  // O modelo precisa ser da loja ativa e não estar na Lixeira.
  const { data: model } = await supabase
    .from("models")
    .select("id, photo_path")
    .eq("id", modelId)
    .eq("tenant_id", g.tenantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!model) return { ok: false, message: GENERIC_ERROR };
  const previous = model.photo_path ? String(model.photo_path) : null;

  const path = `${g.tenantId}/${modelId}/${randomUUID()}.${kind.ext}`;
  const { error: uploadError } = await supabase.storage
    .from(MODEL_BUCKET)
    .upload(path, bytes, { contentType: kind.contentType, upsert: false });
  if (uploadError) return fail("enviar foto", uploadError, "Não foi possível enviar a foto. Tente novamente.");

  const { data, error } = await supabase
    .from("models")
    .update({ photo_path: path, updated_at: new Date().toISOString() })
    .eq("id", modelId)
    .eq("tenant_id", g.tenantId)
    .is("deleted_at", null)
    .select("id");
  if (error || !data || data.length === 0) {
    // Não deixa arquivo órfão (melhor esforço).
    await supabase.storage.from(MODEL_BUCKET).remove([path]);
    return fail("gravar foto", error ?? {}, "Não foi possível enviar a foto. Tente novamente.");
  }

  // Remove a foto anterior (melhor esforço: se falhar, o modelo já usa a nova).
  if (previous) {
    const { error: removeError } = await supabase.storage.from(MODEL_BUCKET).remove([previous]);
    if (removeError) console.error("Erro ao remover foto anterior:", removeError.message);
  }

  revalidateModels();
  return { ok: true };
}

export async function removeModelPhoto(modelId: string): Promise<ModelActionResult> {
  const g = await guard("manage_models");
  if (!g.ok) return g;
  if (!uuidSchema.safeParse(modelId).success) return { ok: false, message: GENERIC_ERROR };

  const supabase = await createClient();
  const { data: model } = await supabase
    .from("models")
    .select("id, photo_path")
    .eq("id", modelId)
    .eq("tenant_id", g.tenantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!model) return { ok: false, message: GENERIC_ERROR };
  const previous = model.photo_path ? String(model.photo_path) : null;

  const { data, error } = await supabase
    .from("models")
    .update({ photo_path: null, updated_at: new Date().toISOString() })
    .eq("id", modelId)
    .eq("tenant_id", g.tenantId)
    .is("deleted_at", null)
    .select("id");
  if (error || !data || data.length === 0) {
    return fail("remover foto", error ?? {}, "Não foi possível remover a foto. Tente novamente.");
  }

  if (previous) {
    const { error: removeError } = await supabase.storage.from(MODEL_BUCKET).remove([previous]);
    if (removeError) console.error("Erro ao remover arquivo da foto:", removeError.message);
  }

  revalidateModels();
  return { ok: true };
}

// ---- Seletor "Modelo" (pedidos e orçamentos) ----

// Carregada quando o seletor abre e a cada busca digitada. Só leitura.
export async function listModelOptions(
  query: string,
): Promise<{ ok: true; options: ModelOption[] } | { ok: false; message: string }> {
  const g = await guard("view_models", false);
  if (!g.ok) return g;
  try {
    return { ok: true, options: await searchModelOptions(typeof query === "string" ? query : "") };
  } catch (error) {
    console.error("Erro ao listar modelos:", error instanceof Error ? error.message : "desconhecido");
    return { ok: false, message: "Não foi possível carregar os modelos." };
  }
}
