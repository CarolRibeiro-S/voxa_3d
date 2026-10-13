import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";
import type { Order, OrderItem, OrderKind, OrderStatus, PaymentStatus } from "@/types/database";

// Colunas reais (migration 018). Os nomes abaixo são a fonte da verdade; confira a Carol antes
// de criar colunas novas.
//
// orders:      id, tenant_id, number (gatilho: nunca enviar no insert), kind ('client' ou 'stock'),
//              status ('placed','printing','ready','shipped','delivered','canceled'), quote_id,
//              client_name, client_phone, due_date, payment_status ('pending' ou 'paid'), paid_at,
//              tracking_code, notes, total (numeric 12,2: NUNCA gravar, o gatilho recalcula a partir
//              de order_items.line_total), status_changed_at, deleted_at, created_at, updated_at
// order_items: id, tenant_id, order_id, quote_item_id (nullable), description, quantity (inteiro
//              maior que zero), unit_price (numeric 12,2), line_total (numeric 12,2, gravável),
//              deleted_at, created_at. Não existe "position": ordene por created_at e depois por id.
//
// Regras do banco: kind 'client' exige client_name (constraint orders_client_has_name). Índice
// único orders_quote_uidx: só um pedido ativo por orçamento (erro 23505).
//
// Planos e assinatura (migration 017):
// plans:         code, name, monthly_price_cents, active
// plan_periods:  code, months, discount_pct, launch_discount_pct, sort_order
// launch_config: id (boolean, linha única), quota, price_months, reservation_minutes, active
// coupons:       id, code, kind (launch ou referral), referrer_name, extra_discount_pct,
//                commission_pct, commission_recurring, active, created_at
// subscriptions: id, tenant_id (unique), plan_code, period_code (nulável), status, trial_ends_at,
//                current_period_end, list_price_cents, charged_price_cents, discount_pct_applied,
//                launch_coupon_id, referral_coupon_id, promo_price_until, mp_preapproval_id,
//                created_at, updated_at

// Dados do próprio tenant (RLS), sem os pedidos excluídos. Nunca lê dados de cálculo.
const ORDER_COLUMNS =
  "id, tenant_id, number, kind, status, quote_id, client_name, client_phone, due_date, payment_status, paid_at, tracking_code, notes, total, status_changed_at, deleted_at, created_at, updated_at";
const ITEM_COLUMNS =
  "id, tenant_id, order_id, quote_item_id, description, quantity, unit_price, line_total, deleted_at, created_at";

// Colunas permitidas ao Operador: sem total, pagamento, telefone, rastreio nem observações. O
// servidor só seleciona estas colunas, não basta esconder na interface.
const ORDER_COLUMNS_RESTRICTED =
  "id, tenant_id, number, kind, status, client_name, due_date, status_changed_at, deleted_at, created_at, updated_at";
const ITEM_COLUMNS_RESTRICTED =
  "id, tenant_id, order_id, quote_item_id, description, quantity, deleted_at, created_at";

const MAX_ORDERS = 500;

const nullable = (v: unknown) => (v === null || v === undefined ? null : String(v));

function toOrder(row: Record<string, unknown>): Order {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    number: Number(row.number),
    kind: row.kind as OrderKind,
    status: row.status as OrderStatus,
    client_name: nullable(row.client_name),
    client_phone: nullable(row.client_phone),
    due_date: nullable(row.due_date),
    payment_status: (row.payment_status as PaymentStatus | undefined) ?? "pending",
    paid_at: nullable(row.paid_at),
    tracking_code: nullable(row.tracking_code),
    notes: nullable(row.notes),
    quote_id: nullable(row.quote_id),
    total: Number(row.total ?? 0),
    status_changed_at: String(row.status_changed_at),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    deleted_at: nullable(row.deleted_at),
  };
}

export async function getOrders(restricted = false): Promise<Order[]> {
  const current = await getCurrentTenant();
  if (!current) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(restricted ? ORDER_COLUMNS_RESTRICTED : ORDER_COLUMNS)
    .eq("tenant_id", current.tenant.id)
    .is("deleted_at", null)
    .order("number", { ascending: false })
    .limit(MAX_ORDERS);
  if (error) throw new Error("Não foi possível carregar os pedidos.");
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(toOrder);
}

export async function getOrderItems(orderIds: string[], restricted = false): Promise<OrderItem[]> {
  const current = await getCurrentTenant();
  if (!current || orderIds.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_items")
    .select(restricted ? ITEM_COLUMNS_RESTRICTED : ITEM_COLUMNS)
    .eq("tenant_id", current.tenant.id)
    .in("order_id", orderIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error("Não foi possível carregar os itens dos pedidos.");

  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    order_id: String(row.order_id),
    quote_item_id: nullable(row.quote_item_id),
    description: String(row.description),
    quantity: Number(row.quantity),
    unit_price: Number(row.unit_price ?? 0),
    line_total: Number(row.line_total ?? 0),
    deleted_at: nullable(row.deleted_at),
    created_at: String(row.created_at),
  }));
}

// Pedido ativo gerado a partir de um orçamento, se existir.
export async function getOrderForQuote(
  quoteId: string,
): Promise<{ id: string; number: number } | null> {
  const current = await getCurrentTenant();
  if (!current) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id, number")
    .eq("tenant_id", current.tenant.id)
    .eq("quote_id", quoteId)
    .is("deleted_at", null)
    .maybeSingle();
  return data ? { id: String(data.id), number: Number(data.number) } : null;
}
