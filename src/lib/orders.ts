import { z } from "zod";
import { brPhoneError, normalizePhoneDigits } from "@/lib/format";
import { modelIdField } from "@/lib/models-schema";
import type { OrderKind, OrderStatus, PaymentStatus } from "@/types/database";

// Compartilhado entre cliente e servidor: sem imports de servidor e sem fórmula de preço.

export const ORDER_KINDS = ["client", "stock"] as const;
export const ORDER_STATUSES = [
  "placed",
  "printing",
  "ready",
  "shipped",
  "delivered",
  "canceled",
] as const;

export const ORDER_KIND_LABEL: Record<OrderKind, string> = {
  client: "Cliente",
  stock: "Produção para estoque",
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "Pedido feito",
  printing: "Imprimindo",
  ready: "Pronto",
  shipped: "Enviado",
  delivered: "Entregue",
  canceled: "Cancelado",
};

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  pending: "Pendente",
  paid: "Pago",
};

// Pedido para estoque termina em "Pronto para estoque".
export function orderStatusLabel(kind: OrderKind, status: OrderStatus): string {
  return kind === "stock" && status === "ready" ? "Pronto para estoque" : ORDER_STATUS_LABEL[status];
}

// Fonte única do fluxo de status, usada pela interface e pelo servidor.
export const ORDER_TRANSITIONS: Record<OrderKind, Record<OrderStatus, readonly OrderStatus[]>> = {
  client: {
    placed: ["printing", "canceled"],
    printing: ["ready", "placed", "canceled"],
    ready: ["shipped", "printing", "canceled"],
    shipped: ["delivered", "ready"],
    delivered: ["shipped"],
    canceled: ["placed"],
  },
  stock: {
    placed: ["printing", "canceled"],
    printing: ["ready", "placed", "canceled"],
    ready: ["printing"],
    shipped: [],
    delivered: [],
    canceled: ["placed"],
  },
};

// Sequência de cada tipo, explícita e independente da ordem das chaves de ORDER_TRANSITIONS.
export const ORDER_SEQUENCE: Record<OrderKind, readonly OrderStatus[]> = {
  client: ["placed", "printing", "ready", "shipped", "delivered"],
  stock: ["placed", "printing", "ready"],
};

export function canOrderTransition(kind: OrderKind, from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[kind][from].includes(to);
}

// Próxima etapa da sequência, só se a transição for permitida.
export function getNextStatus(kind: OrderKind, status: OrderStatus): OrderStatus | null {
  const sequence = ORDER_SEQUENCE[kind];
  const target = sequence[sequence.indexOf(status) + 1];
  return target && canOrderTransition(kind, status, target) ? target : null;
}

// Etapa anterior da sequência, só se a transição for permitida.
export function getPreviousStatus(kind: OrderKind, status: OrderStatus): OrderStatus | null {
  const sequence = ORDER_SEQUENCE[kind];
  const index = sequence.indexOf(status);
  const target = index > 0 ? sequence[index - 1] : undefined;
  return target && canOrderTransition(kind, status, target) ? target : null;
}

// Entregue e cancelado ficam somente leitura até serem reabertos.
export function isOrderLocked(status: OrderStatus): boolean {
  return status === "delivered" || status === "canceled";
}

// Reabrir é sair de entregue ou de cancelado.
export function isReopen(from: OrderStatus): boolean {
  return from === "delivered" || from === "canceled";
}

export interface MoveGroups {
  // Voltar (esquerda) e Avançar (direita). Nulos em pedido Entregue ou Cancelado.
  previous: OrderStatus | null;
  next: OrderStatus | null;
  // Outros destinos permitidos que não são o anterior nem o próximo (vão no menu "Mais").
  others: OrderStatus[];
  // Reabrir, só em pedido Entregue ou Cancelado.
  reopen: OrderStatus | null;
  // Cancelar vai sempre por último e em vermelho.
  cancel: boolean;
}

// A ordem nunca depende da ordem das chaves de ORDER_TRANSITIONS.
export function getMoveGroups(kind: OrderKind, status: OrderStatus): MoveGroups {
  const allowed = ORDER_TRANSITIONS[kind][status];
  const locked = isOrderLocked(status);
  const previous = locked ? null : getPreviousStatus(kind, status);
  const next = locked ? null : getNextStatus(kind, status);
  return {
    previous,
    next,
    others: locked ? [] : allowed.filter((t) => t !== previous && t !== next && t !== "canceled"),
    reopen: locked ? (allowed.find((t) => t !== "canceled") ?? null) : null,
    cancel: allowed.includes("canceled"),
  };
}

export function moveLabel(kind: OrderKind, from: OrderStatus, to: OrderStatus): string {
  if (isReopen(from)) return from === "delivered" ? "Reabrir (volta para Enviado)" : "Reabrir";
  if (to === "canceled") return "Cancelar pedido";
  return orderStatusLabel(kind, to);
}

// Pedido em andamento: ainda conta para prazo atrasado.
export function isOpenForDeadline(kind: OrderKind, status: OrderStatus): boolean {
  if (status === "delivered" || status === "canceled") return false;
  return !(kind === "stock" && status === "ready");
}

export type DueFlag = "overdue" | "soon" | null;

// today é a data de hoje (AAAA-MM-DD) no fuso de São Paulo. Vence em breve: até 2 dias.
export function dueFlag(
  dueDate: string | null,
  today: string,
  kind: OrderKind,
  status: OrderStatus,
): DueFlag {
  if (!dueDate || !isOpenForDeadline(kind, status)) return null;
  if (dueDate < today) return "overdue";
  const days = (Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  return days <= 2 ? "soon" : null;
}

// ---- Validação ----

const INVALID = "Informe um número válido";

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const customerName = z.string().trim().max(120, "Use até 120 caracteres");
const phone = z
  .string()
  .transform(normalizePhoneDigits)
  .superRefine((v, ctx) => {
    const message = v === "" ? null : brPhoneError(v);
    if (message) ctx.addIssue({ code: "custom", message });
  });
const dueDate = z.string().refine((v) => v === "" || isIsoDate(v), "Informe uma data válida");
const notes = z.string().trim().max(1000, "Use até 1000 caracteres");

export const orderItemSchema = z.object({
  description: z.string().trim().min(1, "Informe a descrição do item").max(120, "Use até 120 caracteres"),
  quantity: z
    .number({ error: INVALID })
    .int("Use apenas números inteiros")
    .min(1, "A quantidade mínima é 1")
    .max(9999, "Valor muito alto"),
  unit_price: z
    .number({ error: INVALID })
    .min(0, "Não pode ser negativo")
    .max(999_999.99, "Valor muito alto"),
  // Modelo (desenho) do item, opcional.
  model_id: modelIdField,
});
export type OrderItemValues = z.output<typeof orderItemSchema>;

export const MAX_ORDER_ITEMS = 50;

export const createOrderSchema = z
  .object({
    kind: z.enum(ORDER_KINDS, { error: "Escolha o tipo do pedido" }),
    client_name: customerName,
    client_phone: phone,
    due_date: dueDate,
    notes,
    items: z
      .array(orderItemSchema)
      .min(1, "Adicione pelo menos um item")
      .max(MAX_ORDER_ITEMS, `Use até ${MAX_ORDER_ITEMS} itens`),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "client" && v.client_name === "") {
      ctx.addIssue({ code: "custom", path: ["client_name"], message: "Informe o nome do cliente" });
    }
  });
export type CreateOrderInput = z.input<typeof createOrderSchema>;
export type CreateOrderValues = z.output<typeof createOrderSchema>;

export const editOrderSchema = z.object({
  client_name: customerName,
  client_phone: phone,
  due_date: dueDate,
  tracking_code: z.string().trim().max(60, "Use até 60 caracteres"),
  notes,
});
export type EditOrderInput = z.input<typeof editOrderSchema>;
export type EditOrderValues = z.output<typeof editOrderSchema>;

export const orderStatusSchema = z.enum(ORDER_STATUSES);

// Pagamento informado ao gerar o pedido a partir de um orçamento aprovado.
export const GENERATE_PAYMENT_OPTIONS = ["none", "paid", "deposit"] as const;
export const GENERATE_PAYMENT_LABEL: Record<(typeof GENERATE_PAYMENT_OPTIONS)[number], string> = {
  none: "Ainda não",
  paid: "Já foi pago",
  deposit: "Recebi um sinal",
};

export const generateOrderOptionsSchema = z.object({
  payment: z.enum(GENERATE_PAYMENT_OPTIONS, { error: "Escolha uma opção de pagamento" }),
  due_date: dueDate,
});
export type GenerateOrderOptions = z.input<typeof generateOrderOptionsSchema>;

// ---- Aviso ao cliente (link do WhatsApp, sem API) ----

// O botão "Avisar cliente" aparece em pedidos de cliente que estão Prontos ou Enviados.
export function canNotify(kind: OrderKind, status: OrderStatus): boolean {
  return kind === "client" && (status === "ready" || status === "shipped");
}

// Mensagem pronta para Pronto e Enviado. Telefone em formato internacional: 55 + dígitos.
// Devolve null sem telefone válido.
export function buildNotifyUrl(order: {
  kind: OrderKind;
  status: OrderStatus;
  number: number;
  customerName: string | null;
  customerPhone: string | null;
  trackingCode: string | null;
  // Nome do negócio de tenant_profile, quando existir.
  businessName: string | null;
}): string | null {
  if (!canNotify(order.kind, order.status) || !order.customerPhone) return null;

  const digits = normalizePhoneDigits(order.customerPhone);
  if (brPhoneError(digits) !== null) return null;
  const international = digits.length >= 12 && digits.startsWith("55") ? digits : `55${digits}`;

  const greeting = order.customerName ? `Olá, ${order.customerName}!` : "Olá!";
  const body =
    order.status === "ready"
      ? `${greeting} Seu pedido #${order.number} está pronto. Combinamos a retirada ou o envio?`
      : `${greeting} Seu pedido #${order.number} foi enviado.${
          order.trackingCode ? ` Código de rastreio: ${order.trackingCode}.` : ""
        }`;
  const message = order.businessName ? `${body}\n\n${order.businessName}` : body;
  return `https://wa.me/${international}?text=${encodeURIComponent(message)}`;
}
