"use server";

import { capabilityDenied } from "@/lib/permissions-server";
import { revalidatePath } from "next/cache";
import { listEntityActivity, type ActivityEntry } from "@/lib/audit";
import { writeBlockedMessage } from "@/lib/billing/guard";
import { brPhoneError, normalizePhoneDigits } from "@/lib/format";
import {
  canOrderTransition,
  createOrderSchema,
  editOrderSchema,
  generateOrderOptionsSchema,
  isOrderLocked,
  orderStatusSchema,
  type CreateOrderInput,
  type EditOrderInput,
  type GenerateOrderOptions,
} from "@/lib/orders";
import { unusableModelMessage } from "@/lib/models-data";
import { modelIdField } from "@/lib/models-schema";
import { hasFeature } from "@/lib/plans";
import { can, OPERATOR_MOVE_STATUSES, PERMISSION_DENIED_MESSAGE, type Capability, type Role } from "@/lib/permissions";
import { uuidSchema } from "@/lib/quotes-schema";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant, getCurrentUser } from "@/lib/tenant";
import type {
  OrderInsert,
  OrderItemInsert,
  OrderKind,
  OrderStatus,
} from "@/types/database";

export type OrderActionResult = { ok: true } | { ok: false; message: string };

const GENERIC_ERROR = "Não foi possível salvar. Tente novamente.";
const LOCKED_ERROR = "Este pedido está bloqueado para edição. Reabra para editar.";
const FIRST_ISSUE = "Confira os valores informados.";

const round2 = (n: number) => Math.round(n * 100) / 100;
const emptyToNull = (v: string) => (v === "" ? null : v);

type Guard = { ok: true; tenantId: string; role: Role } | { ok: false; message: string };

// Sessão, tenant da sessão (nunca do navegador), plano com pedidos e conta fora do modo leitura.
async function guard(capability: Capability = "manage_orders"): Promise<Guard> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
  const current = await getCurrentTenant();
  if (!current) return { ok: false, message: "Não encontramos a sua conta." };
  if (!hasFeature(current.tenant.plan, "orders")) {
    return { ok: false, message: "Os pedidos não estão disponíveis no seu plano." };
  }
  // Permissão da função (Dono, Gerente ou Operador), conferida no servidor.
  const denied = await capabilityDenied(capability);
  if (denied) return { ok: false, message: denied };
  // Teste vencido sem assinatura: modo leitura, nada é criado nem editado.
  const blocked = await writeBlockedMessage();
  if (blocked) return { ok: false, message: blocked };
  return { ok: true, tenantId: current.tenant.id, role: current.role };
}

function fail(context: string, error: { code?: string; message?: string }, message = GENERIC_ERROR) {
  // Registra só o código e a mensagem do erro, sem dados do usuário.
  console.error(`Erro em pedidos (${context}):`, error.code, error.message);
  return { ok: false, message } as const;
}

type Db = Awaited<ReturnType<typeof createClient>>;

interface OrderState {
  id: string;
  kind: OrderKind;
  status: OrderStatus;
}

// Estado atual lido do banco, nunca do navegador.
async function loadState(db: Db, tenantId: string, id: string): Promise<OrderState | null> {
  const { data } = await db
    .from("orders")
    .select("id, kind, status")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();
  return data
    ? { id: String(data.id), kind: data.kind as OrderKind, status: data.status as OrderStatus }
    : null;
}

function revalidateOrders() {
  revalidatePath("/pedidos");
}

// Exclusão do pedido que acabou de ser criado quando algo dá errado no meio: vai para a Lixeira.
async function discardOrder(db: Db, tenantId: string, id: string) {
  const now = new Date().toISOString();
  await db
    .from("orders")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", id)
    .eq("tenant_id", tenantId);
}

// ---- Criar ----

export async function createOrder(
  values: CreateOrderInput,
): Promise<{ ok: true; id: string; number: number } | { ok: false; message: string }> {
  const g = await guard();
  if (!g.ok) return g;
  const parsed = createOrderSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? FIRST_ISSUE };
  }
  const v = parsed.data;
  const isClient = v.kind === "client";

  // Os modelos escolhidos precisam ser desta loja e não estar na Lixeira.
  const modelError = await unusableModelMessage(
    g.tenantId,
    v.items.map((item) => item.model_id),
  );
  if (modelError) return { ok: false, message: modelError };

  const supabase = await createClient();
  const row: OrderInsert = {
    tenant_id: g.tenantId,
    kind: v.kind,
    status: "placed",
    payment_status: "pending",
    // Pedido para estoque não tem cliente nem telefone.
    client_name: isClient ? emptyToNull(v.client_name) : null,
    client_phone: isClient ? emptyToNull(v.client_phone) : null,
    due_date: emptyToNull(v.due_date),
    notes: emptyToNull(v.notes),
  };
  const { data, error } = await supabase.from("orders").insert(row).select("id, number").single();
  if (error || !data) return fail("criar", error ?? {});
  const orderId = String(data.id);

  // O total de cada linha é calculado aqui no servidor. O total do pedido é do gatilho.
  const base = Date.now();
  const items: OrderItemInsert[] = v.items.map((item, index) => ({
    tenant_id: g.tenantId,
    order_id: orderId,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    line_total: round2(item.unit_price * item.quantity),
    model_id: item.model_id || null,
    // Mantém a ordem de digitação (ordenação é por created_at e depois por id).
    created_at: new Date(base + index).toISOString(),
  }));
  const { error: itemsError } = await supabase.from("order_items").insert(items);
  if (itemsError) {
    await discardOrder(supabase, g.tenantId, orderId);
    return fail("itens", itemsError);
  }

  revalidateOrders();
  return { ok: true, id: orderId, number: Number(data.number) };
}

export type FromQuoteResult =
  | { ok: true; id: string; number: number }
  | { ok: false; message: string; existing?: { id: string; number: number } };

export async function createOrderFromQuote(
  quoteId: string,
  options: GenerateOrderOptions,
): Promise<FromQuoteResult> {
  const g = await guard();
  if (!g.ok) return g;
  if (!uuidSchema.safeParse(quoteId).success) return { ok: false, message: GENERIC_ERROR };
  const parsedOptions = generateOrderOptionsSchema.safeParse(options);
  if (!parsedOptions.success) {
    return { ok: false, message: parsedOptions.error.issues[0]?.message ?? FIRST_ISSUE };
  }
  const { payment, due_date: dueDateText } = parsedOptions.data;

  const supabase = await createClient();

  // O orçamento precisa ser desta conta, estar aprovado e não estar na Lixeira.
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, status, customer_name, customer_contact")
    .eq("id", quoteId)
    .eq("tenant_id", g.tenantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!quote) return { ok: false, message: GENERIC_ERROR };
  if (quote.status !== "approved") {
    return { ok: false, message: "Só orçamentos aprovados geram pedido." };
  }

  const findExisting = async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, number")
      .eq("tenant_id", g.tenantId)
      .eq("quote_id", quoteId)
      .is("deleted_at", null)
      .maybeSingle();
    return data ? { id: String(data.id), number: Number(data.number) } : null;
  };
  const existing = await findExisting();
  if (existing) {
    return { ok: false, message: `Este orçamento já tem o pedido #${existing.number}`, existing };
  }

  // Só valor e quantidade vêm dos itens. Nada de dados de cálculo.
  const { data: quoteItems, error: itemsReadError } = await supabase
    .from("quote_items")
    .select("id, description, quantity, unit_price_brl, model_id, position")
    .eq("quote_id", quoteId)
    .eq("tenant_id", g.tenantId)
    .is("deleted_at", null)
    .order("position", { ascending: true });
  if (itemsReadError) return fail("ler itens do orçamento", itemsReadError);
  if (!quoteItems || quoteItems.length === 0) {
    return { ok: false, message: "Este orçamento não tem itens." };
  }

  // O contato do orçamento é texto livre: só vira telefone se for um número válido.
  const contactDigits = normalizePhoneDigits(String(quote.customer_contact ?? ""));
  const phone =
    contactDigits !== "" &&
    /^[\d\s()+-]+$/.test(String(quote.customer_contact)) &&
    brPhoneError(contactDigits) === null
      ? contactDigits
      : null;

  const row: OrderInsert = {
    tenant_id: g.tenantId,
    kind: "client",
    status: "placed",
    payment_status: "pending",
    client_name: String(quote.customer_name),
    client_phone: phone,
    quote_id: quoteId,
    due_date: emptyToNull(dueDateText),
    // "Já foi pago" registra o pagamento agora. "Sinal recebido" fica só no texto das observações.
    ...(payment === "paid"
      ? { payment_status: "paid" as const, paid_at: new Date().toISOString() }
      : {}),
    ...(payment === "deposit" ? { notes: "Sinal recebido" } : {}),
  };
  const { data, error } = await supabase.from("orders").insert(row).select("id, number").single();
  if (error || !data) {
    // Índice único: outra aba criou o pedido ao mesmo tempo.
    if (error?.code === "23505") {
      const again = await findExisting();
      return {
        ok: false,
        message: "Este orçamento já tem um pedido ativo",
        ...(again ? { existing: again } : {}),
      };
    }
    return fail("gerar pedido", error ?? {});
  }
  const orderId = String(data.id);

  const base = Date.now();
  const items: OrderItemInsert[] = quoteItems.map((item, index) => {
    const quantity = Number(item.quantity);
    const unit = Number(item.unit_price_brl);
    return {
      tenant_id: g.tenantId,
      order_id: orderId,
      quote_item_id: String(item.id),
      // O modelo do item também vai para o pedido.
      model_id: item.model_id ? String(item.model_id) : null,
      description: String(item.description),
      quantity,
      unit_price: unit,
      // Mesmo total da linha do orçamento.
      line_total: round2(unit * quantity),
      created_at: new Date(base + index).toISOString(),
    };
  });
  const { error: insertError } = await supabase.from("order_items").insert(items);
  if (insertError) {
    await discardOrder(supabase, g.tenantId, orderId);
    return fail("itens do pedido", insertError);
  }

  revalidateOrders();
  revalidatePath(`/orcamentos/${quoteId}`);
  return { ok: true, id: orderId, number: Number(data.number) };
}

// ---- Editar ----

export async function updateOrder(id: string, values: EditOrderInput): Promise<OrderActionResult> {
  const g = await guard();
  if (!g.ok) return g;
  if (!uuidSchema.safeParse(id).success) return { ok: false, message: GENERIC_ERROR };
  const parsed = editOrderSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? FIRST_ISSUE };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const state = await loadState(supabase, g.tenantId, id);
  if (!state) return { ok: false, message: GENERIC_ERROR };
  if (isOrderLocked(state.status)) return { ok: false, message: LOCKED_ERROR };

  const isClient = state.kind === "client";
  if (isClient && v.client_name === "") {
    return { ok: false, message: "Informe o nome do cliente" };
  }

  const { data, error } = await supabase
    .from("orders")
    .update({
      // Pedido para estoque não tem cliente, telefone nem rastreio.
      client_name: isClient ? emptyToNull(v.client_name) : null,
      client_phone: isClient ? emptyToNull(v.client_phone) : null,
      tracking_code: isClient ? emptyToNull(v.tracking_code) : null,
      due_date: emptyToNull(v.due_date),
      notes: emptyToNull(v.notes),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", g.tenantId)
    .is("deleted_at", null)
    .select("id");
  if (error || !data || data.length === 0) return fail("editar", error ?? {});

  revalidateOrders();
  return { ok: true };
}

// ---- Mudar de coluna ----

export async function moveOrder(id: string, to: OrderStatus): Promise<OrderActionResult> {
  const g = await guard("move_orders_basic");
  if (!g.ok) return g;
  if (!uuidSchema.safeParse(id).success || !orderStatusSchema.safeParse(to).success) {
    return { ok: false, message: GENERIC_ERROR };
  }

  // A transição é validada com o status atual do banco, não com o que veio do navegador.
  const supabase = await createClient();
  const state = await loadState(supabase, g.tenantId, id);
  if (!state || !canOrderTransition(state.kind, state.status, to)) {
    return { ok: false, message: "Não foi possível mover o pedido." };
  }

  // O Operador só move entre Pedido feito, Imprimindo e Pronto (nos dois sentidos).
  if (
    !can(g.role, "manage_orders") &&
    !(OPERATOR_MOVE_STATUSES.some((s) => s === state.status) && OPERATOR_MOVE_STATUSES.some((s) => s === to))
  ) {
    return { ok: false, message: PERMISSION_DENIED_MESSAGE };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("orders")
    .update({ status: to, status_changed_at: now, updated_at: now })
    .eq("id", id)
    .eq("tenant_id", g.tenantId)
    // Garante que o status não mudou entre a leitura e a gravação.
    .eq("status", state.status)
    .is("deleted_at", null)
    .select("id");
  if (error || !data || data.length === 0) {
    return fail("mover", error ?? {}, "Não foi possível mover o pedido.");
  }

  revalidateOrders();
  return { ok: true };
}

// ---- Pagamento ----

export async function setOrderPayment(id: string, paid: boolean): Promise<OrderActionResult> {
  const g = await guard();
  if (!g.ok) return g;
  if (!uuidSchema.safeParse(id).success || typeof paid !== "boolean") {
    return { ok: false, message: GENERIC_ERROR };
  }

  const supabase = await createClient();
  const state = await loadState(supabase, g.tenantId, id);
  if (!state) return { ok: false, message: GENERIC_ERROR };
  // Pedido para estoque não tem pagamento.
  if (state.kind !== "client") return { ok: false, message: GENERIC_ERROR };
  // O pagamento é independente do status: vale também para pedido Entregue, sem reabrir.
  // Só o pedido Cancelado fica somente leitura.
  if (state.status === "canceled") return { ok: false, message: LOCKED_ERROR };

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("orders")
    .update({
      payment_status: paid ? "paid" : "pending",
      paid_at: paid ? now : null,
      updated_at: now,
    })
    .eq("id", id)
    .eq("tenant_id", g.tenantId)
    .is("deleted_at", null)
    .select("id");
  if (error || !data || data.length === 0) return fail("pagamento", error ?? {});

  revalidateOrders();
  return { ok: true };
}

// ---- Excluir (Lixeira) ----

export async function deleteOrder(id: string): Promise<OrderActionResult> {
  const g = await guard();
  if (!g.ok) return g;
  if (!uuidSchema.safeParse(id).success) return { ok: false, message: GENERIC_ERROR };

  // Soft delete: o pedido vai para a Lixeira e pode ser restaurado em Histórico.
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("orders")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", id)
    .eq("tenant_id", g.tenantId)
    .is("deleted_at", null)
    .select("id");
  if (error || !data || data.length === 0) {
    return fail("excluir", error ?? {}, "Não foi possível excluir. Tente novamente.");
  }

  revalidateOrders();
  return { ok: true };
}

// ---- Modelo do item ----

// Define, troca ou tira o modelo de um item. Altera só o model_id.
export async function setOrderItemModel(
  itemId: string,
  modelId: string | null,
): Promise<OrderActionResult> {
  const g = await guard("manage_orders");
  if (!g.ok) return g;
  const parsedModel = modelIdField.safeParse(modelId);
  if (!uuidSchema.safeParse(itemId).success || !parsedModel.success) {
    return { ok: false, message: GENERIC_ERROR };
  }
  const newModelId = parsedModel.data || null;

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("order_items")
    .select("id, order_id")
    .eq("id", itemId)
    .eq("tenant_id", g.tenantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!item) return { ok: false, message: GENERIC_ERROR };

  const state = await loadState(supabase, g.tenantId, String(item.order_id));
  if (!state) return { ok: false, message: GENERIC_ERROR };
  if (isOrderLocked(state.status)) return { ok: false, message: LOCKED_ERROR };

  // O modelo precisa ser desta loja e não estar na Lixeira.
  const modelError = await unusableModelMessage(g.tenantId, [newModelId]);
  if (modelError) return { ok: false, message: modelError };

  const { data, error } = await supabase
    .from("order_items")
    .update({ model_id: newModelId })
    .eq("id", itemId)
    .eq("tenant_id", g.tenantId)
    .is("deleted_at", null)
    .select("id");
  if (error || !data || data.length === 0) return fail("modelo do item", error ?? {});

  revalidateOrders();
  return { ok: true };
}

// ---- Histórico do pedido ----

export async function listOrderActivity(
  id: string,
): Promise<{ ok: true; entries: ActivityEntry[] } | { ok: false; message: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
  const denied = await capabilityDenied("view_history");
  if (denied) return { ok: false, message: denied };
  if (!uuidSchema.safeParse(id).success) return { ok: false, message: GENERIC_ERROR };

  try {
    return { ok: true, entries: await listEntityActivity("orders", id) };
  } catch (error) {
    console.error("Erro no histórico do pedido:", error instanceof Error ? error.message : "desconhecido");
    return { ok: false, message: "Não foi possível carregar o histórico." };
  }
}
