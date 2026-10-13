import "server-only";
import type { PriceGrid, QuoteView } from "@/lib/billing/grid-types";
import {
  getBillingCatalog,
  periodLabel,
  quotePrice,
  type BillingCatalog,
} from "@/lib/billing/plans";

// Tabela de preços calculada no servidor: todos os planos em todos os períodos.

export type { PriceGrid, QuoteView };

export function buildPriceGrid(
  catalog: BillingCatalog,
  launch: boolean,
  referralExtraPct: number,
): PriceGrid {
  const quotes: PriceGrid["quotes"] = {};
  for (const plan of catalog.plans) {
    quotes[plan.code] = {};
    for (const period of catalog.periods) {
      const q = quotePrice(
        { planCode: plan.code, periodCode: period.code, launch, referralExtraPct },
        catalog,
      );
      if (q) quotes[plan.code][period.code] = { ...q, savedCents: q.listCents - q.chargedCents };
    }
  }
  return {
    plans: catalog.plans.map((p) => ({ code: p.code, name: p.name })),
    periods: catalog.periods.map((p) => ({
      code: p.code,
      months: p.months,
      label: periodLabel(p.months),
    })),
    quotes,
    launchApplied: launch,
    referralExtraPct,
    launchLockMonths: catalog.launchLockMonths,
  };
}

export async function getInitialPriceGrid(): Promise<PriceGrid | null> {
  try {
    return buildPriceGrid(await getBillingCatalog(), false, 0);
  } catch {
    return null;
  }
}
