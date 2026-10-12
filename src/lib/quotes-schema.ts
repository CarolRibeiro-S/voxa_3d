import { z } from "zod";
import type { QuoteStatus } from "@/types/database";

// Compartilhado entre cliente e servidor: sem imports de servidor e sem fórmula.

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const QUOTE_STATUSES = ["draft", "sent", "approved", "declined"] as const;

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: "Rascunho",
  sent: "Enviado",
  approved: "Aprovado",
  declined: "Recusado",
};

// Fonte única do fluxo de status, usada pela interface e pelo servidor.
export const QUOTE_TRANSITIONS: Record<QuoteStatus, readonly QuoteStatus[]> = {
  draft: ["sent"],
  sent: ["approved", "declined", "draft"],
  approved: ["sent"],
  declined: ["sent"],
};

export function canTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  return QUOTE_TRANSITIONS[from].includes(to);
}

export function transitionLabel(from: QuoteStatus, to: QuoteStatus): string {
  if (to === "sent") return from === "draft" ? "Marcar como enviado" : "Reabrir";
  if (to === "approved") return "Marcar como aprovado";
  if (to === "declined") return "Marcar como recusado";
  return "Voltar para rascunho";
}

// Aprovado e recusado ficam somente leitura até serem reabertos.
export function isQuoteLocked(status: QuoteStatus): boolean {
  return status === "approved" || status === "declined";
}

// 1 vira "0001".
export function formatQuoteNumber(n: number): string {
  return String(n).padStart(4, "0");
}

const INVALID = "Informe um número válido";

export const uuidSchema = z.string().regex(UUID_PATTERN, "Identificador inválido");

const customerName = z
  .string()
  .trim()
  .min(1, "Informe o nome do cliente")
  .max(120, "Use até 120 caracteres");

const description = z
  .string()
  .trim()
  .min(1, "Informe a descrição do item")
  .max(120, "Use até 120 caracteres");

const unitPrice = z
  .number({ error: INVALID })
  .min(0, "Não pode ser negativo")
  .max(999_999.99, "Valor muito alto");

export const newQuoteSchema = z.object({ customer_name: customerName });
export type NewQuoteValues = z.output<typeof newQuoteSchema>;

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const quoteCustomerSchema = z.object({
  customer_name: customerName,
  customer_contact: z.string().trim().max(120, "Use até 120 caracteres"),
  // Vazio significa sem validade.
  valid_until: z.string().refine((v) => v === "" || isIsoDate(v), "Informe uma data válida"),
  notes: z.string().trim().max(1000, "Use até 1000 caracteres"),
});
export type QuoteCustomerValues = z.output<typeof quoteCustomerSchema>;

export const quoteStatusSchema = z.enum(QUOTE_STATUSES);

export const customItemSchema = z.object({
  description,
  quantity: z
    .number({ error: INVALID })
    .int("Use apenas números inteiros")
    .min(1, "A quantidade mínima é 1")
    .max(9999, "Valor muito alto"),
  unit_price_brl: unitPrice,
});
export type CustomItemValues = z.output<typeof customItemSchema>;

export const itemEditSchema = z.object({ description, unit_price_brl: unitPrice });
export type ItemEditValues = z.output<typeof itemEditSchema>;

// Painel "Salvar em um orçamento" das calculadoras. target é "new" ou o id de um rascunho.
export const saveToQuoteFormSchema = z
  .object({
    target: z.string().min(1, "Escolha um orçamento"),
    customer_name: z.string().trim().max(120, "Use até 120 caracteres"),
    description,
    unit_price_brl: unitPrice,
  })
  .superRefine((v, ctx) => {
    if (v.target === "new") {
      if (v.customer_name === "") {
        ctx.addIssue({
          code: "custom",
          path: ["customer_name"],
          message: "Informe o nome do cliente",
        });
      }
    } else if (!UUID_PATTERN.test(v.target)) {
      ctx.addIssue({ code: "custom", path: ["target"], message: "Escolha um orçamento" });
    }
  });
export type SaveToQuoteFormValues = z.output<typeof saveToQuoteFormSchema>;

export const quoteTargetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("existing"), quote_id: uuidSchema }),
  z.object({ type: z.literal("new"), customer_name: customerName }),
]);
export type QuoteTarget = z.output<typeof quoteTargetSchema>;

export const itemDescriptionSchema = description;
export const unitPriceSchema = unitPrice;
