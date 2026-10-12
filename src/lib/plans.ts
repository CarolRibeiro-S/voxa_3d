// Planos e recursos. Preços e descontos NÃO ficam aqui: vêm do banco (src/lib/billing/plans.ts).

export type Plan = "pro" | "loja";

export const PLAN_NAMES: Record<Plan, string> = {
  pro: "Pro",
  loja: "Loja",
};

export type Feature =
  | "calculator"
  | "quotes"
  | "orders_kanban"
  | "finance"
  | "sales_reports"
  | "stock"
  | "maintenance"
  | "channels"
  | "multi_user"
  | "public_quote";

// A calculadora faz parte do Pro e do Loja.
const PRO_FEATURES: Feature[] = [
  "calculator",
  "quotes",
  "orders_kanban",
  "finance",
  "sales_reports",
  "stock",
  "maintenance",
  "channels",
];

export const PLAN_FEATURES: Record<Plan, Feature[]> = {
  pro: PRO_FEATURES,
  loja: [...PRO_FEATURES, "multi_user", "public_quote"],
};

export function hasFeature(plan: Plan, feature: Feature): boolean {
  return PLAN_FEATURES[plan].includes(feature);
}

// Qualquer valor antigo ou desconhecido (como o antigo plano Calculadora) vira Pro.
export function normalizePlan(value: string | null | undefined): Plan {
  return value === "loja" ? "loja" : "pro";
}
