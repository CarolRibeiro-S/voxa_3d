import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";
import type { OrderStatus, PaymentStatus, QuoteStatus } from "@/types/database";

// Os números do Painel vêm de UMA chamada ao RPC dashboard_stats (migration 023), com o cliente do
// usuário (RLS), sem limite de registros. Datas e fechamento de mês no fuso America/Sao_Paulo.
// As listas "Próximas entregas" e "Orçamentos recentes" são consultas curtas (limit 5).
//
// Colunas usadas nas listas (docs/db-schema.txt não existe; nomes das migrations 017 e 018):
// orders: id, number, kind, status, client_name, due_date, payment_status, deleted_at
// quotes: id, number, customer_name, status, total_brl, created_at, deleted_at

const TIME_ZONE = "America/Sao_Paulo";
// São Paulo não tem horário de verão desde 2019: o deslocamento é fixo.
const OFFSET = "-03:00";

const round2 = (n: number) => Math.round(n * 100) / 100;

// Data de hoje (AAAA-MM-DD) em São Paulo.
export function todayInSaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

// Primeiro dia (AAAA-MM-01) do mês de `date`, mais `offset` meses.
function monthStart(date: string, offset: number): string {
  const [y, m] = date.split("-").map(Number);
  const index = y * 12 + (m - 1) + offset;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

// Início do dia `date` em São Paulo, como timestamp ISO com deslocamento.
const startOfDayIso = (date: string) => `${date}T00:00:00${OFFSET}`;

export interface UpcomingOrder {
  id: string;
  number: number;
  clientName: string;
  dueDate: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  overdue: boolean;
}

export interface RecentQuote {
  id: string;
  number: number;
  customerName: string;
  total: number;
  status: QuoteStatus;
}

export interface DashboardData {
  isEmpty: boolean;
  late: number;
  weekDeliveries: number;
  receivable: { count: number; total: number };
  revenue: { current: number; previousMonth: number; changePct: number | null };
  quotesWaiting: { count: number; total: number };
  approvedThisMonth: number;
  stages: { placed: number; printing: number; ready: number; shipped: number };
  stock: { inProgress: number; ready: number };
  upcoming: UpcomingOrder[];
  recentQuotes: RecentQuote[];
}

export type DashboardResult = { ok: true; data: DashboardData } | { ok: false };

const count = z.coerce.number().finite();
const statsSchema = z.object({
  overdue_count: count,
  week_count: count,
  receivable_count: count,
  receivable_total: count,
  revenue_month: count,
  revenue_prev: count,
  quotes_sent_count: count,
  quotes_sent_total: count,
  quotes_approved_month: count,
  stages: z.array(z.object({ kind: z.string(), status: z.string(), count })),
});

export async function getDashboard(): Promise<DashboardResult | null> {
  const current = await getCurrentTenant();
  if (!current) return null;
  const tenantId = current.tenant.id;
  const supabase = await createClient();

  const today = todayInSaoPaulo();
  const [statsRes, upcomingRes, quotesRes, ordersCount, quotesCount, printersCount] =
    await Promise.all([
      supabase.rpc("dashboard_stats", {
        p_tenant: tenantId,
        p_today: today,
        p_month_start: startOfDayIso(monthStart(today, 0)),
        p_next_month_start: startOfDayIso(monthStart(today, 1)),
        p_prev_month_start: startOfDayIso(monthStart(today, -1)),
      }),
      supabase
        .from("orders")
        .select("id, number, status, client_name, due_date, payment_status")
        .eq("tenant_id", tenantId)
        .eq("kind", "client")
        .is("deleted_at", null)
        .not("status", "in", "(delivered,canceled)")
        .not("due_date", "is", null)
        .order("due_date", { ascending: true })
        .order("number", { ascending: true })
        .limit(5),
      supabase
        .from("quotes")
        .select("id, number, customer_name, status, total_brl")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .is("deleted_at", null),
      supabase
        .from("quotes")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .is("deleted_at", null),
      supabase
        .from("tenant_printers")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .is("deleted_at", null),
    ]);

  // Se o resumo falhar, nada de zeros no lugar: a página mostra um aviso de erro.
  if (statsRes.error) {
    console.error("Erro em dashboard_stats:", statsRes.error.code, statsRes.error.message);
    return { ok: false };
  }
  const raw: unknown = Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data;
  const parsed = statsSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("Retorno inesperado de dashboard_stats");
    return { ok: false };
  }
  if (upcomingRes.error || quotesRes.error) {
    console.error(
      "Erro nas listas do Painel:",
      upcomingRes.error?.code ?? quotesRes.error?.code,
      upcomingRes.error?.message ?? quotesRes.error?.message,
    );
    return { ok: false };
  }
  const stats = parsed.data;

  const stage = (kind: string, status: string) =>
    stats.stages
      .filter((s) => s.kind === kind && s.status === status)
      .reduce((sum, s) => sum + s.count, 0);

  const revenue = round2(stats.revenue_month);
  const previous = round2(stats.revenue_prev);

  return {
    ok: true,
    data: {
      isEmpty:
        (ordersCount.count ?? 0) === 0 &&
        (quotesCount.count ?? 0) === 0 &&
        (printersCount.count ?? 0) === 0,
      late: stats.overdue_count,
      weekDeliveries: stats.week_count,
      receivable: { count: stats.receivable_count, total: round2(stats.receivable_total) },
      revenue: {
        current: revenue,
        previousMonth: previous,
        // Com o mês anterior zerado só o valor é mostrado.
        changePct: previous > 0 ? Math.round(((revenue - previous) / previous) * 100) : null,
      },
      quotesWaiting: { count: stats.quotes_sent_count, total: round2(stats.quotes_sent_total) },
      approvedThisMonth: stats.quotes_approved_month,
      stages: {
        placed: stage("client", "placed"),
        printing: stage("client", "printing"),
        ready: stage("client", "ready"),
        shipped: stage("client", "shipped"),
      },
      stock: {
        inProgress: stage("stock", "placed") + stage("stock", "printing"),
        ready: stage("stock", "ready"),
      },
      upcoming: (upcomingRes.data ?? []).map((o) => ({
        id: String(o.id),
        number: Number(o.number),
        clientName: o.client_name === null ? "Sem nome" : String(o.client_name),
        dueDate: String(o.due_date),
        status: o.status as OrderStatus,
        paymentStatus: o.payment_status as PaymentStatus,
        overdue: String(o.due_date) < today,
      })),
      recentQuotes: (quotesRes.data ?? []).map((q) => ({
        id: String(q.id),
        number: Number(q.number),
        customerName: String(q.customer_name),
        total: Number(q.total_brl ?? 0),
        status: q.status as QuoteStatus,
      })),
    },
  };
}
