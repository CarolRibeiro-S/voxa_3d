// O que cada plano inclui, em texto para as páginas de planos. Só recursos que já existem no
// sistema entram em "included". O que ainda não existe aparece como "soon" (em breve), conforme
// o roteiro do produto. Sem imports de servidor.

export interface PlanFeatureList {
  included: string[];
  soon: string[];
}

const PRO_INCLUDED = [
  "Calculadoras de impressão FDM e de resina",
  "Cadastro de máquinas, com catálogo de impressoras",
  "Cadastro de filamentos e resinas",
  "Custos e margens, com a tarifa de energia da sua distribuidora",
  "Orçamentos com PDF para o cliente",
  "Pedidos em colunas, do pedido feito até a entrega",
  "Preço sugerido para cada canal de venda",
  "Várias peças na mesma impressão",
  "Histórico de alterações, com lixeira e desfazer",
];

export const PLAN_FEATURE_LISTS: Record<string, PlanFeatureList> = {
  pro: {
    included: PRO_INCLUDED,
    soon: ["Financeiro", "Vendas e relatórios", "Estoque", "Manutenção"],
  },
  loja: {
    included: ["Tudo do plano Pro", ...PRO_INCLUDED],
    soon: [
      "Vários usuários com permissão por aba",
      "Orçamento online para o cliente",
      "Financeiro, relatórios, estoque e manutenção",
    ],
  },
};

export const PLAN_TAGLINES: Record<string, string> = {
  pro: "Para quem trabalha sozinho",
  loja: "Para quem tem mais de um usuário",
};
