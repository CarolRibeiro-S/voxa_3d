// Funções e permissões: fonte única. Sem imports de servidor, para a interface esconder o que a
// função não pode usar. A segurança de verdade está no servidor (requireCapability).

export type Role = "owner" | "manager" | "operator";

export const ROLES: readonly Role[] = ["owner", "manager", "operator"];

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Dono",
  manager: "Gerente",
  operator: "Operador",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  owner: "Pode tudo, incluindo assinatura e usuários.",
  manager: "Pode tudo, menos assinatura e usuários.",
  operator:
    "Usa só os Pedidos: vê cliente, itens, prazo e etapa, e move o pedido entre Pedido feito, Imprimindo e Pronto. Não vê valores nem telefone.",
};

export const CAPABILITIES = [
  "view_dashboard",
  "use_calculators",
  "view_catalog",
  "manage_catalog",
  "view_quotes",
  "manage_quotes",
  "view_settings",
  "manage_settings",
  "view_orders",
  // Criar, editar, cancelar, excluir, pagar, enviar, entregar e avisar o cliente.
  "manage_orders",
  // Mover pedidos entre Pedido feito, Imprimindo e Pronto (o Operador só tem esta).
  "move_orders_basic",
  // Ver valores, pagamento, telefone e observações dos pedidos.
  "view_money",
  "view_history",
  "undo_history",
  "view_subscription",
  "manage_subscription",
  "view_users",
  "manage_users",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const ALL: readonly Capability[] = CAPABILITIES;

const MATRIX: Record<Role, readonly Capability[]> = {
  owner: ALL,
  manager: ALL.filter(
    (c) =>
      c !== "view_subscription" &&
      c !== "manage_subscription" &&
      c !== "view_users" &&
      c !== "manage_users",
  ),
  operator: ["view_orders", "move_orders_basic"],
};

export const PERMISSION_DENIED_MESSAGE = "Você não tem permissão para fazer isso.";

// Etapas que o Operador pode mover (nos dois sentidos).
export const OPERATOR_MOVE_STATUSES = ["placed", "printing", "ready"] as const;

// Valor vindo do banco vira uma função conhecida. Qualquer valor desconhecido vira Operador
// (o menor acesso).
export function normalizeRole(value: unknown): Role {
  return value === "owner" || value === "manager" || value === "operator" ? value : "operator";
}

export function capabilitiesOf(role: Role): Capability[] {
  return [...MATRIX[role]];
}

export function can(role: Role | null | undefined, capability: Capability): boolean {
  return role ? MATRIX[role].includes(capability) : false;
}

// Página inicial de cada função.
export function homePathFor(role: Role): string {
  return can(role, "view_dashboard") ? "/painel" : "/pedidos";
}
