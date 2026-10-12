import { z } from "zod";

// Compartilhado entre cliente e servidor: sem imports de servidor e sem fórmula.

const INVALID = "Informe um número válido";
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MAX_MATERIALS = 8;
export const MAX_EXTRAS = 10;

export function integer(min: number, max: number, minMessage = "Não pode ser negativo") {
  return z
    .number({ error: INVALID })
    .int("Use apenas números inteiros")
    .min(min, minMessage)
    .max(max, "Valor muito alto");
}

export function money(max: number) {
  return z
    .number({ error: INVALID })
    .min(0, "Não pode ser negativo")
    .max(max, "Valor muito alto");
}

const materialLineSchema = z.object({
  material_id: z
    .string({ error: "Escolha o material" })
    .regex(UUID_PATTERN, "Escolha o material"),
  part_grams: z
    .number({ error: INVALID })
    .gt(0, "Informe o peso da peça")
    .max(100_000, "Valor muito alto"),
  support_grams: z
    .number({ error: INVALID })
    .min(0, "Não pode ser negativo")
    .max(100_000, "Valor muito alto")
    .default(0),
});

export const extraSchema = z.object({
  label: z
    .string({ error: "Informe a descrição" })
    .trim()
    .min(1, "Informe a descrição")
    .max(40, "Use até 40 caracteres"),
  value_brl: money(999_999.99),
});

export const fdmCalcSchema = z
  .object({
    printer_id: z
      .string({ error: "Escolha a máquina" })
      .regex(UUID_PATTERN, "Escolha a máquina"),
    materials: z
      .array(materialLineSchema)
      .min(1, "Adicione pelo menos um material")
      .max(MAX_MATERIALS, `Use até ${MAX_MATERIALS} materiais`),
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
          message: "Este material já foi adicionado",
        });
      }
      seen.add(key);
    });
  });

export type FdmCalcInput = z.input<typeof fdmCalcSchema>;
export type FdmCalcValues = z.output<typeof fdmCalcSchema>;
