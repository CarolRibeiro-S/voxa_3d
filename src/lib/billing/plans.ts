import "server-only";
import { createClient } from "@/lib/supabase/server";

// Catálogo de planos, períodos e preços. Tudo vem do banco: nenhum preço fixo no código.
// Valores em centavos inteiros. O navegador nunca decide valor.
//
// Nomes de colunas usados (ajuste só aqui se o banco tiver outros):
//   plans:        code, name, monthly_price_cents
//   plan_periods: code, months, discount_pct, launch_discount_pct
//   launch_config: lock_months (opcional, padrão 12)

export interface PlanCatalogEntry {
  code: string;
  name: string;
  monthlyPriceCents: number;
}

export interface PeriodCatalogEntry {
  code: string;
  months: number;
  // Desconto do período e desconto do período quando há cupom de lançamento.
  discountPct: number;
  launchDiscountPct: number;
}

export interface BillingCatalog {
  plans: PlanCatalogEntry[];
  periods: PeriodCatalogEntry[];
  launchLockMonths: number;
}

export interface PriceQuote {
  // Preço de tabela do período (mensal × meses), sem desconto.
  listCents: number;
  chargedCents: number;
  pctApplied: number;
  perMonthCents: number;
}

export interface QuoteInput {
  planCode: string;
  periodCode: string;
  // Cupom de lançamento válido: o desconto do período é SUBSTITUÍDO pelo de lançamento.
  launch: boolean;
  // Cupom de indicação: pontos percentuais somados ao desconto final.
  referralExtraPct: number;
}

// Função pura. total = mensal × meses × (1 − pct/100), arredondado só no final.
// Descontos de período e de lançamento nunca se acumulam. A indicação soma pontos ao final.
export function quotePrice(input: QuoteInput, catalog: BillingCatalog): PriceQuote | null {
  const plan = catalog.plans.find((p) => p.code === input.planCode);
  const period = catalog.periods.find((p) => p.code === input.periodCode);
  if (!plan || !period) return null;

  const base = input.launch ? period.launchDiscountPct : period.discountPct;
  const pct = Math.min(100, Math.max(0, base + Math.max(0, input.referralExtraPct)));

  const listCents = plan.monthlyPriceCents * period.months;
  const chargedCents = Math.round((listCents * (100 - pct)) / 100);
  return {
    listCents,
    chargedCents,
    pctApplied: pct,
    perMonthCents: Math.round(chargedCents / period.months),
  };
}

const num = (value: unknown): number | null => {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null;

export async function getBillingCatalog(): Promise<BillingCatalog> {
  const supabase = await createClient();
  const [plansRes, periodsRes, launchRes] = await Promise.all([
    supabase.from("plans").select("*"),
    supabase.from("plan_periods").select("*"),
    supabase.from("launch_config").select("*").limit(1),
  ]);
  if (plansRes.error || periodsRes.error) {
    console.error(
      "Erro ao carregar o catálogo de planos:",
      plansRes.error?.code ?? periodsRes.error?.code,
      plansRes.error?.message ?? periodsRes.error?.message,
    );
    throw new Error("Não foi possível carregar os planos.");
  }

  const plans: PlanCatalogEntry[] = [];
  for (const row of plansRes.data ?? []) {
    const code = text(row.code);
    const price = num(row.monthly_price_cents);
    if (code && price !== null) {
      plans.push({ code, name: text(row.name) ?? code, monthlyPriceCents: price });
    }
  }

  const periods: PeriodCatalogEntry[] = [];
  for (const row of periodsRes.data ?? []) {
    const code = text(row.code);
    const months = num(row.months);
    if (code && months !== null && months > 0) {
      periods.push({
        code,
        months,
        discountPct: num(row.discount_pct) ?? 0,
        launchDiscountPct: num(row.launch_discount_pct) ?? num(row.discount_pct) ?? 0,
      });
    }
  }
  periods.sort((a, b) => a.months - b.months);

  const lock = num(launchRes.data?.[0]?.lock_months);
  return { plans, periods, launchLockMonths: lock && lock > 0 ? lock : 12 };
}

// Vagas restantes com preço de lançamento. Função pública do banco.
export async function getLaunchRemaining(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("launch_remaining");
  if (error) {
    console.error("Erro em launch_remaining:", error.code, error.message);
    return 0;
  }
  const n = num(Array.isArray(data) ? data[0] : data);
  return n === null ? 0 : Math.max(0, Math.floor(n));
}

// Rótulo do período pela duração, para não depender do código usado no banco.
export function periodLabel(months: number): string {
  if (months === 1) return "Mensal";
  if (months === 3) return "Trimestral";
  if (months === 6) return "Semestral";
  if (months === 12) return "Anual";
  return `${months} meses`;
}
