import { z } from "zod";

// Compartilhado entre cliente e servidor: só a validação da entrada, sem a conta.

const INVALID = "Informe um número válido";

export const hourlyRateSchema = z.object({
  monthly_goal_brl: z
    .number({ error: INVALID })
    .min(0, "Não pode ser negativo")
    .max(100_000, "Valor muito alto"),
  hours_per_week: z
    .number({ error: INVALID })
    .min(1, "Informe de 1 a 80 horas")
    .max(80, "Informe de 1 a 80 horas"),
  productive_pct: z
    .number({ error: INVALID })
    .min(10, "Informe de 10% a 100%")
    .max(100, "Informe de 10% a 100%"),
});

export type HourlyRateInput = z.input<typeof hourlyRateSchema>;
