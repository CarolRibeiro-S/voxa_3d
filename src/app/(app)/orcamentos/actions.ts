"use server";

import { revalidatePath } from "next/cache";
import { computeFdm } from "@/lib/calc/fdm";
import { computeResin } from "@/lib/calc/resin";
import { fdmCalcSchema, type FdmCalcInput } from "@/lib/fdm-calc-schema";
import { hasFeature } from "@/lib/plans";
import { checkCalcLimit } from "@/lib/pricing-core";
import {
  canTransition,
  customItemSchema,
  itemDescriptionSchema,
  isQuoteLocked,
  itemEditSchema,
  newQuoteSchema,
  quoteCustomerSchema,
  quoteStatusSchema,
  quoteTargetSchema,
  unitPriceSchema,
  uuidSchema,
  type CustomItemValues,
  type ItemEditValues,
  type NewQuoteValues,
  type QuoteCustomerValues,
} from "@/lib/quotes-schema";
import { resinCalcSchema, type ResinCalcInput } from "@/lib/resin-calc-schema";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant, getCurrentUser } from "@/lib/tenant";
import type {
  QuoteInsert,
  QuoteItemInsert,
  QuoteStatus,
  QuoteUpdate,
} from "@/types/database";

export type ActionResult = { ok: true } | { ok: false; message: string };

const GENERIC_ERROR = "Não foi possível salvar. Tente novamente.";
const SESSION_ERROR = "Sua sessão expirou. Entre novamente.";
const NOT_DRAFT_ERROR = "Só é possível adicionar itens a orçamentos em rascunho.";
const FIRST_ISSUE = "Confira os valores informados.";
const LOCKED_ERROR = "Este orçamento está bloqueado para edição. Reabra para editar.";

type Guard = { ok: true; tenantId: string } | { ok: false; message: string };

// Sessão, tenant da sessão (nunca do formulário) e plano com orçamentos.
async function guard(): Promise<Guard> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: SESSION_ERROR };
  const current = await getCurrentTenant();
  if (!current) return { ok: false, message: "Não encontramos a sua conta." };
  if (!hasFeature(current.tenant.plan, "quotes")) {
    return { ok: false, message: "Os orçamentos não estão disponíveis no seu plano." };
  }
  return { ok: true, tenantId: current.tenant.id };
}

function fail(context: string, error: { code?: string; message?: string }, message = GENERIC_ERROR) {
  // Registra só o código e a mensagem do erro, sem dados do usuário.
  console.error(`Erro em orçamentos (${context}):`, error.code, error.message);
  return { ok: false, message } as const;
}

// Data de hoje no fuso de São Paulo mais N dias, no formato AAAA-MM-DD.
function todayPlusDays(days: number): string {
  const date = new Date(Date.now() + days * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
}

const emptyToNull = (value: string) => (value === "" ? null : value);

type Db = Awaited<ReturnType<typeof createClient>>;

// Status atual lido do banco, nunca do navegador. null se não existir ou for de outra conta.
async function currentStatus(
  supabase: Db,
  tenantId: string,
  quoteId: string,
): Promise<QuoteStatus | null> {
  const { data } = await supabase
    .from("quotes")
    .select("status")
    .eq("id", quoteId)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();
  return data ? (data.status as QuoteStatus) : null;
}

// Status do orçamento a que um item pertence.
async function itemQuoteStatus(
  supabase: Db,
  tenantId: string,
  itemId: string,
): Promise<QuoteStatus | null> {
  const { data } = await supabase
    .from("quote_items")
    .select("quote_id")
    .eq("id", itemId)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();
  return data ? currentStatus(supabase, tenantId, String(data.quote_id)) : null;
}

function revalidateQuote(id?: string) {
  revalidatePath("/orcamentos");
  if (id) revalidatePath(`/orcamentos/${id}`);
}

// ---- Orçamento ----

export async function createQuote(
  values: NewQuoteValues,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const g = await guard();
  if (!g.ok) return g;
  const parsed = newQuoteSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? FIRST_ISSUE };
  }

  const row: QuoteInsert = {
    tenant_id: g.tenantId,
    customer_name: parsed.data.customer_name,
    status: "draft",
    valid_until: todayPlusDays(7),
  };
  const supabase = await createClient();
  const { data, error } = await supabase.from("quotes").insert(row).select("id").single();
  if (error || !data) return fail("criar", error ?? {});

  revalidateQuote();
  return { ok: true, id: String(data.id) };
}

export async function updateQuoteCustomer(
  id: string,
  values: QuoteCustomerValues,
): Promise<ActionResult> {
  const g = await guard();
  if (!g.ok) return g;
  if (!uuidSchema.safeParse(id).success) return { ok: false, message: GENERIC_ERROR };
  const parsed = quoteCustomerSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? FIRST_ISSUE };
  }
  const v = parsed.data;

  const patch: QuoteUpdate = {
    customer_name: v.customer_name,
    customer_contact: emptyToNull(v.customer_contact),
    valid_until: emptyToNull(v.valid_until),
    notes: emptyToNull(v.notes),
    updated_at: new Date().toISOString(),
  };
  const supabase = await createClient();
  const status = await currentStatus(supabase, g.tenantId, id);
  if (status === null) return { ok: false, message: GENERIC_ERROR };
  if (isQuoteLocked(status)) return { ok: false, message: LOCKED_ERROR };

  const { data, error } = await supabase
    .from("quotes")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", g.tenantId)
    .is("deleted_at", null)
    .select("id");
  if (error || !data || data.length === 0) return fail("cliente", error ?? {});

  revalidateQuote(id);
  return { ok: true };
}

export async function setQuoteStatus(id: string, status: QuoteStatus): Promise<ActionResult> {
  const g = await guard();
  if (!g.ok) return g;
  if (!uuidSchema.safeParse(id).success || !quoteStatusSchema.safeParse(status).success) {
    return { ok: false, message: GENERIC_ERROR };
  }

  // A transição é validada com o status atual do banco, não com o que veio do navegador.
  const supabase = await createClient();
  const from = await currentStatus(supabase, g.tenantId, id);
  if (from === null || !canTransition(from, status)) {
    return { ok: false, message: "Não foi possível alterar o status." };
  }

  const now = new Date().toISOString();
  const patch: QuoteUpdate = {
    status,
    // Ao aprovar grava a data. Ao reabrir (ou sair de aprovado), limpa.
    approved_at: status === "approved" ? now : null,
    updated_at: now,
  };
  const { data, error } = await supabase
    .from("quotes")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", g.tenantId)
    // Garante que o status não mudou entre a leitura e a gravação.
    .eq("status", from)
    .is("deleted_at", null)
    .select("id");
  if (error || !data || data.length === 0) {
    return fail("status", error ?? {}, "Não foi possível alterar o status.");
  }

  revalidateQuote(id);
  return { ok: true };
}

export async function deleteQuote(id: string): Promise<ActionResult> {
  const g = await guard();
  if (!g.ok) return g;
  if (!uuidSchema.safeParse(id).success) return { ok: false, message: GENERIC_ERROR };

  // Soft delete: só o orçamento vai para a Lixeira. Os itens ficam e voltam junto.
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("quotes")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", id)
    .eq("tenant_id", g.tenantId)
    .is("deleted_at", null)
    .select("id");
  if (error || !data || data.length === 0) {
    return fail("excluir", error ?? {}, "Não foi possível excluir. Tente novamente.");
  }

  revalidateQuote();
  return { ok: true };
}

// ---- Itens ----

// Posição seguinte ao último item do orçamento. Conta também os itens na Lixeira (sem filtrar
// deleted_at) de propósito: assim, um item restaurado nunca repete a posição de um novo.
async function nextPosition(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  quoteId: string,
): Promise<number> {
  const { data } = await supabase
    .from("quote_items")
    .select("position")
    .eq("quote_id", quoteId)
    .eq("tenant_id", tenantId)
    .order("position", { ascending: false })
    .limit(1);
  const last = data?.[0]?.position;
  return last === undefined || last === null ? 1 : Number(last) + 1;
}

async function isDraftQuote(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  quoteId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("quotes")
    .select("status")
    .eq("id", quoteId)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();
  return data?.status === "draft";
}

export async function addCustomItem(
  quoteId: string,
  values: CustomItemValues,
): Promise<ActionResult> {
  const g = await guard();
  if (!g.ok) return g;
  if (!uuidSchema.safeParse(quoteId).success) return { ok: false, message: GENERIC_ERROR };
  const parsed = customItemSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? FIRST_ISSUE };
  }

  const supabase = await createClient();
  if (!(await isDraftQuote(supabase, g.tenantId, quoteId))) {
    return { ok: false, message: NOT_DRAFT_ERROR };
  }

  const row: QuoteItemInsert = {
    tenant_id: g.tenantId,
    quote_id: quoteId,
    position: await nextPosition(supabase, g.tenantId, quoteId),
    kind: "custom",
    description: parsed.data.description,
    quantity: parsed.data.quantity,
    unit_price_brl: parsed.data.unit_price_brl,
  };
  const { error } = await supabase.from("quote_items").insert(row);
  if (error) return fail("item avulso", error);

  revalidateQuote(quoteId);
  return { ok: true };
}

export async function updateQuoteItem(
  itemId: string,
  values: ItemEditValues,
): Promise<ActionResult> {
  const g = await guard();
  if (!g.ok) return g;
  if (!uuidSchema.safeParse(itemId).success) return { ok: false, message: GENERIC_ERROR };
  const parsed = itemEditSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? FIRST_ISSUE };
  }

  const supabase = await createClient();
  const status = await itemQuoteStatus(supabase, g.tenantId, itemId);
  if (status === null) return { ok: false, message: GENERIC_ERROR };
  if (isQuoteLocked(status)) return { ok: false, message: LOCKED_ERROR };

  const { data, error } = await supabase
    .from("quote_items")
    .update({
      description: parsed.data.description,
      unit_price_brl: parsed.data.unit_price_brl,
    })
    .eq("id", itemId)
    .eq("tenant_id", g.tenantId)
    .is("deleted_at", null)
    .select("quote_id");
  if (error || !data || data.length === 0) return fail("editar item", error ?? {});

  revalidateQuote(String(data[0].quote_id));
  return { ok: true };
}

export async function removeQuoteItem(itemId: string): Promise<ActionResult> {
  const g = await guard();
  if (!g.ok) return g;
  if (!uuidSchema.safeParse(itemId).success) return { ok: false, message: GENERIC_ERROR };

  const supabase = await createClient();
  const status = await itemQuoteStatus(supabase, g.tenantId, itemId);
  if (status === null) return { ok: false, message: GENERIC_ERROR };
  if (isQuoteLocked(status)) return { ok: false, message: LOCKED_ERROR };

  // Soft delete: o item vai para a Lixeira e pode ser restaurado em Histórico.
  const { data, error } = await supabase
    .from("quote_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("tenant_id", g.tenantId)
    .is("deleted_at", null)
    .select("quote_id");
  if (error || !data || data.length === 0) {
    return fail("remover item", error ?? {}, "Não foi possível remover. Tente novamente.");
  }

  revalidateQuote(String(data[0].quote_id));
  return { ok: true };
}

// ---- Salvar a partir das calculadoras ----

export interface DraftQuoteOption {
  id: string;
  number: number;
  customer_name: string;
}

// Carregada só quando o painel abre.
export async function listDraftQuotes(): Promise<
  { ok: true; quotes: DraftQuoteOption[] } | { ok: false; message: string }
> {
  const g = await guard();
  if (!g.ok) return g;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("id, number, customer_name")
    .eq("tenant_id", g.tenantId)
    .eq("status", "draft")
    .is("deleted_at", null)
    .order("number", { ascending: false })
    .limit(100);
  if (error) return fail("listar rascunhos", error, "Não foi possível carregar os orçamentos.");

  return {
    ok: true,
    quotes: (data ?? []).map((row) => ({
      id: String(row.id),
      number: Number(row.number),
      customer_name: String(row.customer_name),
    })),
  };
}

export async function addQuoteItemFromCalculation(
  kind: "fdm" | "resin",
  input: FdmCalcInput | ResinCalcInput,
  target: unknown,
  description: string,
  finalUnitPrice: number,
): Promise<{ ok: true; quoteId: string; number: number } | { ok: false; message: string }> {
  const g = await guard();
  if (!g.ok) return g;
  const current = await getCurrentTenant();
  if (!current || !hasFeature(current.tenant.plan, "calculator")) {
    return { ok: false, message: "A calculadora não está disponível no seu plano." };
  }

  // Nenhum número vindo do navegador é confiado: o preço sugerido é recalculado aqui.
  if (kind !== "fdm" && kind !== "resin") return { ok: false, message: GENERIC_ERROR };
  const parsedTarget = quoteTargetSchema.safeParse(target);
  const parsedDescription = itemDescriptionSchema.safeParse(description);
  const parsedPrice = unitPriceSchema.safeParse(finalUnitPrice);
  const parsedInput =
    kind === "fdm" ? fdmCalcSchema.safeParse(input) : resinCalcSchema.safeParse(input);
  for (const r of [parsedTarget, parsedDescription, parsedPrice, parsedInput]) {
    if (!r.success) return { ok: false, message: r.error.issues[0]?.message ?? FIRST_ISSUE };
  }
  if (!parsedTarget.success || !parsedDescription.success || !parsedPrice.success || !parsedInput.success) {
    return { ok: false, message: FIRST_ISSUE };
  }

  const supabase = await createClient();

  // Orçamento existente: só rascunho aceita itens.
  if (parsedTarget.data.type === "existing") {
    if (!(await isDraftQuote(supabase, g.tenantId, parsedTarget.data.quote_id))) {
      return { ok: false, message: NOT_DRAFT_ERROR };
    }
  }

  // Salvar um item é um cálculo: conta no limite por hora.
  const limitMessage = await checkCalcLimit(supabase, kind);
  if (limitMessage) return { ok: false, message: limitMessage };

  const result =
    kind === "fdm"
      ? await computeFdm(parsedInput.data as FdmCalcInput)
      : await computeResin(parsedInput.data as ResinCalcInput);
  if (!result.ok) return result;

  let quoteId: string;
  let number: number;
  let createdHere = false;
  if (parsedTarget.data.type === "existing") {
    quoteId = parsedTarget.data.quote_id;
    const { data } = await supabase
      .from("quotes")
      .select("number")
      .eq("id", quoteId)
      .eq("tenant_id", g.tenantId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!data) return { ok: false, message: GENERIC_ERROR };
    number = Number(data.number);
  } else {
    const row: QuoteInsert = {
      tenant_id: g.tenantId,
      customer_name: parsedTarget.data.customer_name,
      status: "draft",
      valid_until: todayPlusDays(7),
    };
    const { data, error } = await supabase.from("quotes").insert(row).select("id, number").single();
    if (error || !data) return fail("novo orçamento", error ?? {});
    quoteId = String(data.id);
    number = Number(data.number);
    createdHere = true;
  }

  const item: QuoteItemInsert = {
    tenant_id: g.tenantId,
    quote_id: quoteId,
    position: await nextPosition(supabase, g.tenantId, quoteId),
    kind,
    description: parsedDescription.data,
    quantity: result.quantity,
    suggested_unit_price_brl: result.perUnit.price,
    unit_price_brl: parsedPrice.data,
    calc_input: parsedInput.data,
    calc_result: result,
  };
  const { error: itemError } = await supabase.from("quote_items").insert(item);
  if (itemError) {
    if (createdHere) {
      // Limpeza do orçamento criado agora: vai para a Lixeira, como toda exclusão.
      await supabase
        .from("quotes")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", quoteId)
        .eq("tenant_id", g.tenantId);
    }
    return fail("item da calculadora", itemError);
  }

  revalidateQuote(quoteId);
  return { ok: true, quoteId, number };
}
