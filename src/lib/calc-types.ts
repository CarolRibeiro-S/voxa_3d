// Tipos do resultado das calculadoras. Só tipos: sem fórmula e sem imports de servidor.

export interface CalcBreakdown {
  price: number;
  profit: number;
  cost: number;
  material: number;
  energy: number;
  wear: number;
  maintenance: number;
  labor: number;
  extras: number;
  packaging: number;
  failures: number;
  fees: number;
}

export type CalcResult =
  | {
      ok: true;
      perUnit: CalcBreakdown;
      total: { price: number; profit: number };
      quantity: number;
      warnings: string[];
    }
  | { ok: false; message: string };

export type CalcSuccess = Extract<CalcResult, { ok: true }>;
