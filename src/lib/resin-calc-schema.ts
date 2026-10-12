import { z } from "zod";
import { extraSchema, integer, MAX_EXTRAS, money, UUID_PATTERN } from "@/lib/fdm-calc-schema";

// Compartilhado entre cliente e servidor: sem imports de servidor e sem fórmula.

const INVALID = "Informe um número válido";

export const MAX_RESIN_MATERIALS = 4;

// Volume em ml com até 1 casa decimal.
const oneDecimal = (n: number) => Math.abs(n * 10 - Math.round(n * 10)) < 1e-6;

const materialLineSchema = z.object({
  material_id: z
    .string({ error: "Escolha a resina" })
    .regex(UUID_PATTERN, "Escolha a resina"),
  part_ml: z
    .number({ error: INVALID })
    .gt(0, "Informe o volume da peça")
    .max(100_000, "Valor muito alto")
    .refine(oneDecimal, "Use no máximo 1 casa decimal"),
  support_ml: z
    .number({ error: INVALID })
    .min(0, "Não pode ser negativo")
    .max(100_000, "Valor muito alto")
    .refine(oneDecimal, "Use no máximo 1 casa decimal")
    .default(0),
});

export const resinCalcSchema = z
  .object({
    printer_id: z
      .string({ error: "Escolha a máquina" })
      .regex(UUID_PATTERN, "Escolha a máquina"),
    materials: z
      .array(materialLineSchema)
      .min(1, "Adicione pelo menos uma resina")
      .max(MAX_RESIN_MATERIALS, `Use até ${MAX_RESIN_MATERIALS} resinas`),
    print_hours: integer(0, 9999),
    print_minutes: integer(0, 59),
    labor_minutes: integer(0, 99_999).default(0),
    extras: z.array(extraSchema).max(MAX_EXTRAS, `Use até ${MAX_EXTRAS} itens extras`),
    packaging_brl: money(999_999.99),
    quantity: integer(1, 9999, "A quantidade mínima é 1").default(1),
    margin_pct: integer(0, 999),
  })
  .superRefine((v, ctx) => {
    if (v.print_hours + v.print_minutes <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["print_hours"],
        message: "Informe o tempo de impressão",
      });
    }

    const seen = new Set<string>();
    v.materials.forEach((line, index) => {
      const key = line.material_id.toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["materials", index, "material_id"],
          message: "Esta resina já foi adicionada",
        });
      }
      seen.add(key);
    });
  });

export type ResinCalcInput = z.input<typeof resinCalcSchema>;
export type ResinCalcValues = z.output<typeof resinCalcSchema>;
