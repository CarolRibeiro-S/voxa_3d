import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";
import type { Quote, QuoteItem, QuoteItemKind, QuoteStatus } from "@/types/database";

// Dados do próprio tenant (RLS). Nunca selecionar calc_input nem calc_result aqui.
const QUOTE_COLUMNS =
  "id, tenant_id, number, customer_name, customer_contact, status, valid_until, notes, total_brl, approved_at, deleted_at, created_at, updated_at";
const ITEM_COLUMNS =
  "id, tenant_id, quote_id, position, kind, description, quantity, suggested_unit_price_brl, unit_price_brl, model_id, deleted_at, created_at";

type QuoteRow = Record<keyof Quote, unknown>;
type ItemRow = Record<keyof QuoteItem, unknown>;

function toQuote(row: QuoteRow): Quote {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    number: Number(row.number),
    customer_name: String(row.customer_name),
    customer_contact: (row.customer_contact as string | null) ?? null,
    status: row.status as QuoteStatus,
    valid_until: (row.valid_until as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    total_brl: Number(row.total_brl ?? 0),
    approved_at: (row.approved_at as string | null) ?? null,
    deleted_at: (row.deleted_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function toItem(row: ItemRow): QuoteItem {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    quote_id: String(row.quote_id),
    position: Number(row.position),
    kind: row.kind as QuoteItemKind,
    description: String(row.description),
    quantity: Number(row.quantity),
    suggested_unit_price_brl:
      row.suggested_unit_price_brl === null || row.suggested_unit_price_brl === undefined
        ? null
        : Number(row.suggested_unit_price_brl),
    unit_price_brl: Number(row.unit_price_brl),
    model_id: (row.model_id as string | null) ?? null,
    deleted_at: (row.deleted_at as string | null) ?? null,
    created_at: String(row.created_at),
  };
}

// Escapa os curingas do ilike para a busca ser literal.
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function getQuotes(filters: {
  search: string;
  status: QuoteStatus | null;
}): Promise<Quote[]> {
  const current = await getCurrentTenant();
  if (!current) return [];

  const supabase = await createClient();
  let query = supabase
    .from("quotes")
    .select(QUOTE_COLUMNS)
    .eq("tenant_id", current.tenant.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.search) query = query.ilike("customer_name", `%${escapeLike(filters.search)}%`);

  const { data, error } = await query;
  if (error) throw new Error("Não foi possível carregar os orçamentos.");
  return ((data ?? []) as unknown as QuoteRow[]).map(toQuote);
}

export async function getQuote(id: string): Promise<Quote | null> {
  const current = await getCurrentTenant();
  if (!current) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select(QUOTE_COLUMNS)
    .eq("id", id)
    .eq("tenant_id", current.tenant.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar o orçamento.");
  return data ? toQuote(data as unknown as QuoteRow) : null;
}

export async function getQuoteItems(quoteId: string): Promise<QuoteItem[]> {
  const current = await getCurrentTenant();
  if (!current) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quote_items")
    .select(ITEM_COLUMNS)
    .eq("quote_id", quoteId)
    .eq("tenant_id", current.tenant.id)
    .is("deleted_at", null)
    .order("position", { ascending: true });
  if (error) throw new Error("Não foi possível carregar os itens.");
  return ((data ?? []) as unknown as ItemRow[]).map(toItem);
}
