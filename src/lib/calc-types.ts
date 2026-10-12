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

// Preço sugerido em um canal de venda (comissão, taxas e taxa fixa já considerados).
export interface ChannelPrice {
  id: string;
  name: string;
  // false quando comissão, taxas e margem somam 100% ou mais. Os valores ficam em 0.
  available: boolean;
  pricePerUnit: number;
  feesPerUnit: number;
  profitPerUnit: number;
  total: number;
}

// Informação extra de quem imprime várias peças na mesma mesa.
export interface PlatesInfo {
  piecesPerPlate: number;
  platesNeeded: number;
  totalHours: number;
  totalMinutes: number;
}

export type CalcResult =
  | {
      ok: true;
      perUnit: CalcBreakdown;
      total: { price: number; profit: number };
      quantity: number;
      warnings: string[];
      // null quando o plano não tem canais de venda. Lista vazia quando não há canal cadastrado.
      channels: ChannelPrice[] | null;
      // null quando é uma peça por mesa.
      plates: PlatesInfo | null;
    }
  | { ok: false; message: string };

export type CalcSuccess = Extract<CalcResult, { ok: true }>;
