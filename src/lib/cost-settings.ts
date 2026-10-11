import { z } from "zod";

const INVALID = "Informe um número válido";

function money(max: number) {
  return z
    .number({ error: INVALID })
    .min(0, "Não pode ser negativo")
    .max(max, "Valor muito alto");
}

// Percentual com até 2 casas, arredondado para 2 casas.
function percentDecimal() {
  return z
    .number({ error: INVALID })
    .min(0, "Não pode ser negativo")
    .max(999.99, "Valor muito alto")
    .transform((n) => Math.round(n * 100) / 100);
}

function percent(max = 999) {
  return z
    .number({ error: INVALID })
    .int("Use apenas números inteiros")
    .min(0, "Não pode ser negativo")
    .max(max, "Valor muito alto");
}

// Campos que entram na soma de margem, taxas e imposto.
export const SUM_FIELDS = [
  "default_margin_pct",
  "marketplace_fee_pct",
  "payment_fee_pct",
  "tax_pct",
] as const;

// Soma em centésimos de ponto percentual (inteiros), sem erro de ponto flutuante.
export function sumPercentCents(
  v: Partial<Record<(typeof SUM_FIELDS)[number], number>>,
): number {
  return SUM_FIELDS.reduce((total, key) => total + Math.round((v[key] ?? 0) * 100), 0);
}

export const costSettingsSchema = z
  .object({
    energy_kwh_brl: money(9999.9999),
    labor_hour_brl: money(999999.99),
    packaging_default_brl: money(999999.99),
    failure_rate_pct: z
      .number({ error: INVALID })
      .int("Use apenas números inteiros")
      .min(0, "Não pode ser negativo")
      .lt(90, "A taxa de falha precisa ser menor que 90%"),
    default_margin_pct: percent(),
    marketplace_fee_pct: percentDecimal(),
    payment_fee_pct: percentDecimal(),
    tax_pct: percentDecimal(),
  })
  .superRefine((v, ctx) => {
    if (sumPercentCents(v) >= 10_000) {
      ctx.addIssue({
        code: "custom",
        path: ["default_margin_pct"],
        message: "A soma de margem, taxas e imposto precisa ser menor que 100%",
      });
    }
  });

export type CostSettingsValues = z.output<typeof costSettingsSchema>;
