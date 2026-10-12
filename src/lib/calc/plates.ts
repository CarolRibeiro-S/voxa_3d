import "server-only";
import type { PlatesInfo } from "@/lib/calc-types";
import type { FdmCalcValues } from "@/lib/fdm-calc-schema";
import type { ResinCalcValues } from "@/lib/resin-calc-schema";

// Várias peças na mesma impressão: os valores digitados são da mesa inteira e aqui viram valores
// por peça. A embalagem NÃO é dividida (é por unidade vendida) e a quantidade continua sendo o
// número de peças a vender.

export interface PlateNormalized<V> {
  values: V;
  // Horas de impressão por peça, sem arredondar antes.
  hours: number;
}

// Com uma peça por mesa devolve a entrada idêntica, sem nenhuma conta nos valores.
export function normalizeFdmPlate(v: FdmCalcValues): PlateNormalized<FdmCalcValues> {
  const plateHours = v.print_hours + v.print_minutes / 60;
  const n = v.piecesPerPlate;
  if (!(n > 1)) return { values: v, hours: plateHours };

  return {
    values: {
      ...v,
      materials: v.materials.map((line) => ({
        ...line,
        part_grams: line.part_grams / n,
        support_grams: line.support_grams / n,
      })),
      labor_minutes: v.labor_minutes / n,
      extras: v.extras.map((item) => ({ ...item, value_brl: item.value_brl / n })),
    },
    hours: plateHours / n,
  };
}

export function normalizeResinPlate(v: ResinCalcValues): PlateNormalized<ResinCalcValues> {
  const plateHours = v.print_hours + v.print_minutes / 60;
  const n = v.piecesPerPlate;
  if (!(n > 1)) return { values: v, hours: plateHours };

  return {
    values: {
      ...v,
      materials: v.materials.map((line) => ({
        ...line,
        part_ml: line.part_ml / n,
        support_ml: line.support_ml / n,
      })),
      labor_minutes: v.labor_minutes / n,
      extras: v.extras.map((item) => ({ ...item, value_brl: item.value_brl / n })),
    },
    hours: plateHours / n,
  };
}

// Mesas necessárias e tempo total de impressão. null quando é uma peça por mesa.
export function platesInfo(v: {
  piecesPerPlate: number;
  quantity: number;
  print_hours: number;
  print_minutes: number;
}): PlatesInfo | null {
  if (!(v.piecesPerPlate > 1)) return null;
  const platesNeeded = Math.ceil(v.quantity / v.piecesPerPlate);
  const totalMinutes = platesNeeded * (v.print_hours * 60 + v.print_minutes);
  return {
    piecesPerPlate: v.piecesPerPlate,
    platesNeeded,
    totalHours: Math.floor(totalMinutes / 60),
    totalMinutes: totalMinutes % 60,
  };
}
