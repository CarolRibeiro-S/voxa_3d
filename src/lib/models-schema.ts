import { z } from "zod";

// Compartilhado entre cliente e servidor: sem imports de servidor aqui.

export const MODEL_BUCKET = "model-photos";
export const MODEL_NOTES_MAX = 2000;
export const MODEL_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const MODEL_PHOTO_SIGNED_SECONDS = 3600;
export const MODEL_NAME_ERROR = "Já existe um modelo com esse nome.";

const INVALID = "Informe um número válido";

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const modelFormSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do modelo").max(120, "Use até 120 caracteres"),
  source_url: z
    .string()
    .trim()
    .max(500, "Use até 500 caracteres")
    .refine((v) => v === "" || isHttpUrl(v), "Informe um link que comece com http:// ou https://"),
  material_hint: z.string().trim().max(80, "Use até 80 caracteres"),
  // Gramas com até 2 casas decimais (a coluna é numeric(10,2)).
  weight_g: z
    .number({ error: INVALID })
    .gt(0, "O peso precisa ser maior que 0")
    .max(100_000, "O peso máximo é 100.000 g")
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "Use até 2 casas decimais")
    .nullable(),
  hours: z
    .number({ error: INVALID })
    .int("Use um número inteiro")
    .min(0, "Não pode ser negativo")
    .max(999, "Valor muito alto")
    .nullable(),
  minutes: z
    .number({ error: INVALID })
    .int("Use um número inteiro")
    .min(0, "Não pode ser negativo")
    .max(59, "Use de 0 a 59 minutos")
    .nullable(),
  print_notes: z.string().trim().max(MODEL_NOTES_MAX, `Use até ${MODEL_NOTES_MAX} caracteres`),
});
export type ModelFormValues = z.output<typeof modelFormSchema>;

// Horas e minutos do formulário viram um único valor em minutos (nulo se ambos vazios).
export function toTotalMinutes(hours: number | null, minutes: number | null): number | null {
  if (hours === null && minutes === null) return null;
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function splitMinutes(total: number | null): { hours: number | null; minutes: number | null } {
  if (total === null) return { hours: null, minutes: null };
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

// "1 h 30 min", "45 min" ou "2 h".
export function formatPrintTime(total: number | null): string {
  if (total === null) return "";
  const h = Math.floor(total / 60);
  const m = total % 60;
  return [h > 0 ? `${h} h` : "", m > 0 || h === 0 ? `${m} min` : ""].filter(Boolean).join(" ");
}

// Opção do seletor "Modelo" (miniatura com URL assinada, gerada no servidor).
export interface ModelOption {
  id: string;
  name: string;
  photoUrl: string | null;
}

// Cartão da página Modelos.
export interface ModelCardData extends ModelOption {
  sourceUrl: string | null;
  materialHint: string | null;
  weightG: number | null;
  printMinutes: number | null;
  printNotes: string | null;
}

// O que o pedido mostra de um modelo, inclusive para o Operador: nunca dinheiro.
export interface OrderModelInfo extends ModelOption {
  materialHint: string | null;
  printNotes: string | null;
  sourceUrl: string | null;
  // Modelo na Lixeira: continua legível nos pedidos antigos.
  removed: boolean;
}

// Id de modelo opcional nos formulários: vazio ou nulo é "Sem modelo".
export const modelIdField = z
  .union([
    z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
    z.literal(""),
  ])
  .nullable()
  .optional();
