import { z } from "zod";
import { formatMoneyDigits } from "@/lib/format";
import type { MaterialKind } from "@/types/database";

// Compartilhado entre cliente e servidor: sem imports de servidor aqui.

export const MATERIAL_KINDS = ["filament", "resin"] as const;

export const KIND_INFO: Record<
  MaterialKind,
  { label: string; plural: string; unit: string; perUnit: string; suggestions: string[] }
> = {
  filament: {
    label: "Filamento",
    plural: "Filamentos",
    unit: "g",
    perUnit: "por grama",
    suggestions: ["PLA", "PETG", "ABS", "ASA", "TPU", "Nylon"],
  },
  resin: {
    label: "Resina",
    plural: "Resinas",
    unit: "ml",
    perUnit: "por ml",
    suggestions: ["Standard", "ABS-like", "Flexível", "Lavável em água", "Dental"],
  },
};

const INVALID = "Informe um número válido";

export const materialSchema = z.object({
  kind: z.enum(MATERIAL_KINDS),
  name: z
    .string()
    .trim()
    .min(1, "Informe o nome do material")
    .max(80, "Use até 80 caracteres"),
  brand: z.string().trim().max(60, "Use até 60 caracteres"),
  material_type: z.string().trim().max(40, "Use até 40 caracteres"),
  color: z.string().trim().max(30, "Use até 30 caracteres"),
  price_brl: z
    .number({ error: INVALID })
    .min(0, "Não pode ser negativo")
    .max(99_999_999.99, "Valor muito alto"),
  package_size: z
    .number({ error: "Informe o tamanho da embalagem" })
    .int("Use um número inteiro")
    .min(1, "O tamanho precisa ser maior que 0")
    .max(999_999, "Valor muito alto"),
  stock_remaining: z
    .number({ error: INVALID })
    .int("Use um número inteiro")
    .min(0, "Não pode ser negativo")
    .max(999_999, "Valor muito alto")
    .nullable(),
});

export type MaterialValues = z.output<typeof materialSchema>;

// Custo por grama ou ml. null quando o tamanho não é válido.
export function costPerUnit(price: number, size: number | null): number | null {
  if (!size || size <= 0 || !Number.isFinite(price)) return null;
  return price / size;
}

// "R$ 0,0899" (sempre 4 casas, nunca arredondado para 2).
export function formatUnitCost(cost: number): string {
  return `R$ ${formatMoneyDigits(cost, 4)}`;
}

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value: string | null): value is string {
  return !!value && HEX_COLOR.test(value.trim());
}

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("pt-BR");
}

export function isSameMaterial(
  a: { name: string; brand: string | null; color: string | null },
  b: { name: string; brand: string | null; color: string | null },
) {
  return (
    normalize(a.name) === normalize(b.name) &&
    normalize(a.brand) === normalize(b.brand) &&
    normalize(a.color) === normalize(b.color)
  );
}
