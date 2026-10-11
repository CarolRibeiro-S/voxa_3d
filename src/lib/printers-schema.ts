import { z } from "zod";
import type { PowerBasis, PrinterType } from "@/types/database";

// Compartilhado entre cliente e servidor: sem imports de servidor aqui.

export const PRINTER_TYPES = ["fdm", "resin"] as const;

export const PRINTER_TYPE_LABEL: Record<PrinterType, string> = {
  fdm: "FDM",
  resin: "Resina",
};

const INVALID = "Informe um número válido";

export const printerSchema = z.object({
  type: z.enum(PRINTER_TYPES),
  nickname: z.string().trim().max(60, "Use até 60 caracteres"),
  brand: z
    .string()
    .trim()
    .min(1, "Informe a marca")
    .max(60, "Use até 60 caracteres"),
  model: z
    .string()
    .trim()
    .min(1, "Informe o modelo")
    .max(80, "Use até 80 caracteres"),
  power_w: z
    .number({ error: INVALID })
    .gt(0, "Deve ser maior que 0")
    .max(20_000, "O máximo é 20.000 W")
    .nullable(),
  price_brl: z
    .number({ error: INVALID })
    .min(0, "Não pode ser negativo")
    .max(99_999_999.99, "Valor muito alto")
    .nullable(),
  lifespan_hours: z
    .number({ error: INVALID })
    .int("Use um número inteiro")
    .min(1, "O mínimo é 1 hora")
    .max(200_000, "O máximo é 200.000 horas")
    .nullable(),
  maintenance_brl_per_hour: z
    .number({ error: INVALID })
    .min(0, "Não pode ser negativo")
    .max(999_999.99, "Valor muito alto"),
  notes: z.string().trim().max(300, "Use até 300 caracteres"),
});

export type PrinterValues = z.output<typeof printerSchema>;

// O que a tela recebe do catálogo, para UMA máquina escolhida.
export interface CatalogListItem {
  type: PrinterType;
  brand: string;
  model: string;
}

export interface CatalogPrinterView {
  // Usado só para gravar o vínculo. Nunca é mostrado na tela.
  catalogId: string;
  type: PrinterType;
  brand: string;
  model: string;
  avgPowerW: number | null;
  powerBasis: PowerBasis | null;
  priceRefBrl: number | null;
  priceRefLabel: string | null;
  enclosed: boolean | null;
  hardenedNozzle: boolean | null;
  multicolor: boolean | null;
  screenSizeIn: number | null;
  buildArea: string | null;
}

export const POWER_BASIS_LABEL: Record<PowerBasis, string> = {
  fabricante: "Dado do fabricante",
  medicao: "Medição",
  estimativa: "Estimativa",
};
