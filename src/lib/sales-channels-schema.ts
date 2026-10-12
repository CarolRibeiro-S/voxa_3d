import { z } from "zod";

// Compartilhado entre cliente e servidor: sem imports de servidor e sem fórmula.

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MAX_SALES_CHANNELS = 20;

// Atalhos que só preenchem o nome. Nenhuma taxa vem junto.
export const CHANNEL_PRESETS = [
  "Shopee",
  "Mercado Livre",
  "Elo7",
  "Amazon",
  "Venda direta",
  "Outro",
] as const;

// Texto digitado ("4,5" ou "4.5") vira número. Vazio ou inválido vira null.
export function parseDecimal(text: string): number | null {
  const clean = text.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Number(clean);
}

// 4.5 vira "4,50".
export function decimalToText(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function decimalField(options: { required: string; max: number; maxMessage: string }) {
  return z
    .string({ error: options.required })
    .trim()
    .min(1, options.required)
    .transform((text, ctx) => {
      const n = parseDecimal(text);
      if (n === null) {
        ctx.addIssue({ code: "custom", message: "Use um número com até 2 casas decimais" });
        return z.NEVER;
      }
      return n;
    })
    .pipe(z.number().min(0, "Não pode ser negativo").max(options.max, options.maxMessage));
}

const PCT_MAX_MESSAGE = "Precisa ser menor que 100%";

// Os campos numéricos viajam como texto no formulário, para poderem ficar vazios (sem padrão).
export const salesChannelSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do canal").max(40, "Use até 40 caracteres"),
  commission_pct: decimalField({
    required: "Informe a comissão",
    max: 99.99,
    maxMessage: PCT_MAX_MESSAGE,
  }),
  fixed_fee_brl: decimalField({
    required: "Informe a taxa fixa (pode ser 0)",
    max: 9999.99,
    maxMessage: "Valor muito alto",
  }),
  payment_pct: decimalField({
    required: "Informe a taxa de pagamento",
    max: 99.99,
    maxMessage: PCT_MAX_MESSAGE,
  }),
  tax_pct: decimalField({
    required: "Informe o imposto",
    max: 99.99,
    maxMessage: PCT_MAX_MESSAGE,
  }),
});

export type SalesChannelInput = z.input<typeof salesChannelSchema>;
export type SalesChannelValues = z.output<typeof salesChannelSchema>;

export const salesChannelIdSchema = z.string().regex(UUID_PATTERN, "Identificador inválido");
