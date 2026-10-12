import "server-only";
import type { CalcResult } from "@/lib/calc-types";
import { resinCalcSchema, type ResinCalcInput, type ResinCalcValues } from "@/lib/resin-calc-schema";
import {
  buildWarnings,
  CALC_GENERIC_ERROR,
  priceFromBase,
  round2,
  toNumber,
  type PricingSettings,
} from "@/lib/pricing-core";
import { createClient } from "@/lib/supabase/server";
import { getCostSettings, getCurrentTenant } from "@/lib/tenant";

// Cálculo da peça de resina. Não chama calc_check_limit: quem chama decide quando contar no limite.

export interface ResinPrinterRow {
  power_w: unknown;
  price_brl: unknown;
  lifespan_hours: unknown;
  maintenance_brl_per_hour: unknown;
}

interface MaterialRow {
  id: string;
  cost_per_unit: unknown;
}

export interface ResinSettings extends PricingSettings {
  energy_kwh_brl: number;
  labor_hour_brl: number;
}

// Parte pura do cálculo, tudo por UMA peça.
export function computeResinPrice(
  v: ResinCalcValues,
  printer: ResinPrinterRow,
  costById: Map<string, number>,
  settings: ResinSettings,
): CalcResult {
  const powerW = toNumber(printer.power_w);
  const printerPrice = toNumber(printer.price_brl);
  const lifespanHours = toNumber(printer.lifespan_hours);
  const maintenancePerHour = Number(printer.maintenance_brl_per_hour ?? 0);

  const material = v.materials.reduce(
    (total, line) =>
      total + (line.part_ml + line.support_ml) * (costById.get(line.material_id) ?? 0),
    0,
  );
  const hours = v.print_hours + v.print_minutes / 60;
  const energy = powerW !== null ? (powerW / 1000) * hours * settings.energy_kwh_brl : 0;
  const wear =
    printerPrice !== null && lifespanHours !== null && lifespanHours > 0
      ? hours * (printerPrice / lifespanHours)
      : 0;
  const maintenance = hours * maintenancePerHour;
  const labor = (v.labor_minutes / 60) * settings.labor_hour_brl;
  const extras = v.extras.reduce((total, item) => total + item.value_brl, 0);

  const base = material + energy + wear + maintenance + labor + extras;

  const priced = priceFromBase(base, v, settings);
  if (!priced.ok) return priced;

  const values = [material, energy, wear, maintenance, labor, ...priced.raw];
  if (!values.every(Number.isFinite)) return { ok: false, message: CALC_GENERIC_ERROR };

  return {
    ok: true,
    perUnit: {
      ...priced.perUnit,
      material: round2(material),
      energy: round2(energy),
      wear: round2(wear),
      maintenance: round2(maintenance),
      labor: round2(labor),
      extras: round2(extras),
    },
    total: priced.total,
    quantity: v.quantity,
    warnings: buildWarnings({
      energyKwhBrl: settings.energy_kwh_brl,
      laborHourBrl: settings.labor_hour_brl,
      laborMinutes: v.labor_minutes,
      powerW,
      printerPrice,
      lifespanHours,
    }),
  };
}

// Valida a entrada, busca máquina, resinas e configurações do tenant da sessão (RLS) e calcula.
export async function computeResin(input: ResinCalcInput): Promise<CalcResult> {
  const current = await getCurrentTenant();
  if (!current) return { ok: false, message: "Não encontramos a sua conta." };
  const { tenant } = current;

  const parsed = resinCalcSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Confira os valores informados.",
    };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const materialIds = v.materials.map((line) => line.material_id);

  const [printerRes, materialsRes, settings] = await Promise.all([
    supabase
      .from("tenant_printers")
      .select("power_w, price_brl, lifespan_hours, maintenance_brl_per_hour")
      .eq("id", v.printer_id)
      .eq("tenant_id", tenant.id)
      .eq("type", "resin")
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("materials")
      .select("id, cost_per_unit")
      .in("id", materialIds)
      .eq("tenant_id", tenant.id)
      .eq("kind", "resin")
      .eq("is_active", true)
      .is("deleted_at", null),
    getCostSettings(tenant.id),
  ]);

  const printer = printerRes.data as ResinPrinterRow | null;
  const materialRows = (materialsRes.data ?? []) as MaterialRow[];
  if (printerRes.error || materialsRes.error || !printer || !settings) {
    return { ok: false, message: CALC_GENERIC_ERROR };
  }
  const costById = new Map(materialRows.map((m) => [m.id, Number(m.cost_per_unit)]));
  if (materialIds.some((id) => !costById.has(id))) {
    return { ok: false, message: CALC_GENERIC_ERROR };
  }

  return computeResinPrice(v, printer, costById, settings);
}
