export type Plan = "calculadora" | "pro" | "loja";

export type Feature =
  | "calculator"
  | "quotes"
  | "orders_kanban"
  | "finance"
  | "sales_reports"
  | "stock"
  | "maintenance"
  | "multi_user"
  | "public_quote";

const PRO_FEATURES: Feature[] = [
  "calculator",
  "quotes",
  "orders_kanban",
  "finance",
  "sales_reports",
  "stock",
  "maintenance",
];

export const PLAN_FEATURES: Record<Plan, Feature[]> = {
  calculadora: ["calculator", "quotes"],
  pro: PRO_FEATURES,
  loja: [...PRO_FEATURES, "multi_user", "public_quote"],
};

export function hasFeature(plan: Plan, feature: Feature): boolean {
  return PLAN_FEATURES[plan].includes(feature);
}

export interface PlanMeta {
  id: Plan;
  name: string;
  price: number;
  billing: "unico" | "mensal";
  description: string;
}

export const PLANS: Record<Plan, PlanMeta> = {
  calculadora: {
    id: "calculadora",
    name: "Calculadora",
    price: 47,
    billing: "unico",
    description: "Pagamento único",
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 79,
    billing: "mensal",
    description: "Por mês, 1 usuário",
  },
  loja: {
    id: "loja",
    name: "Loja",
    price: 149,
    billing: "mensal",
    description: "Por mês, vários usuários com permissão por aba",
  },
};
