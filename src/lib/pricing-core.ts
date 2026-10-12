import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChannelPrice } from "@/lib/calc-types";

// Núcleo comum de preço das calculadoras. Só roda no servidor.

export const CALC_SESSION_ERROR = "Sua sessão expirou. Entre novamente.";
export const CALC_GENERIC_ERROR = "Não foi possível calcular agora. Tente novamente.";
const RATE_LIMIT_ERROR = "Muitos cálculos nesta hora. Tente novamente em alguns minutos.";
const SUM_ERROR =
  "A soma de margem, taxas e imposto precisa ser menor que 100%. Ajuste em Configurações ou na margem desta peça.";

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const toNumber = (v: unknown) => (v === null || v === undefined ? null : Number(v));

// Cada cálculo conta no limite por hora. Devolve a mensagem de erro, ou null se pode calcular.
export async function checkCalcLimit(
  supabase: SupabaseClient,
  kind: "fdm" | "resin",
): Promise<string | null> {
  const { error } = await supabase.rpc("calc_check_limit", { p_kind: kind });
  if (!error) return null;

  if (error.code === "P0001" || (error.message ?? "").includes("Limite de consultas atingido")) {
    return RATE_LIMIT_ERROR;
  }
  // Registra só o código e a mensagem do erro, sem dados do usuário.
  console.error("Erro na RPC calc_check_limit:", error.code, error.message);
  return CALC_GENERIC_ERROR;
}

export interface PricingSettings {
  failure_rate_pct: number;
  marketplace_fee_pct: number;
  payment_fee_pct: number;
  tax_pct: number;
}

export interface PricingOrder {
  packaging_brl: number;
  quantity: number;
  margin_pct: number;
}

export type PricingOutcome =
  | {
      ok: true;
      perUnit: {
        price: number;
        profit: number;
        cost: number;
        packaging: number;
        failures: number;
        fees: number;
      };
      total: { price: number; profit: number };
      // Custo por peça (falhas e embalagem incluídas) antes de margem e taxas, sem arredondar.
      costBeforeFees: number;
      // Valores sem arredondar, só para checar se ficaram finitos.
      raw: number[];
    }
  | { ok: false; message: string };

// Parte do cálculo igual para FDM e resina, a partir do custo base de UMA peça.
export function priceFromBase(
  base: number,
  order: PricingOrder,
  settings: PricingSettings,
): PricingOutcome {
  // Soma em centésimos inteiros, sem erro de ponto flutuante.
  const sumCents = [
    order.margin_pct,
    settings.marketplace_fee_pct,
    settings.payment_fee_pct,
    settings.tax_pct,
  ].reduce((total, n) => total + Math.round(n * 100), 0);
  if (sumCents >= 10_000) return { ok: false, message: SUM_ERROR };
  if (settings.failure_rate_pct >= 100) return { ok: false, message: CALC_GENERIC_ERROR };

  const feesPct = settings.marketplace_fee_pct + settings.payment_fee_pct + settings.tax_pct;

  const withFailures = base / (1 - settings.failure_rate_pct / 100);
  // A embalagem é uma por pedido, dividida entre as peças.
  const packaging = order.packaging_brl / order.quantity;
  const cost = withFailures + packaging;

  const price = cost / (1 - sumCents / 10_000);
  const profit = (price * order.margin_pct) / 100;
  const fees = (price * feesPct) / 100;
  const failures = withFailures - base;

  return {
    ok: true,
    perUnit: {
      price: round2(price),
      profit: round2(profit),
      cost: round2(cost),
      packaging: round2(packaging),
      failures: round2(failures),
      fees: round2(fees),
    },
    // O total usa o preço sem arredondar e arredonda só no fim.
    total: {
      price: round2(price * order.quantity),
      profit: round2(profit * order.quantity),
    },
    costBeforeFees: cost,
    raw: [price, profit, cost, failures, fees],
  };
}

export interface ChannelRates {
  id: string;
  name: string;
  commission_pct: number;
  payment_pct: number;
  tax_pct: number;
  fixed_fee_brl: number;
}

// Preço por canal de venda. costBeforeFees é o custo por peça já com falhas e embalagem, antes
// de margem, comissão, pagamento e imposto. A taxa fixa vale por unidade vendida.
export function computeChannelPrices(
  costBeforeFees: number,
  marginPct: number,
  quantity: number,
  channels: ChannelRates[],
): ChannelPrice[] {
  return channels.map((channel) => {
    // Soma em centésimos inteiros, como no resto do núcleo.
    const sumCents = [marginPct, channel.commission_pct, channel.payment_pct, channel.tax_pct].reduce(
      (total, n) => total + Math.round(n * 100),
      0,
    );
    if (sumCents >= 10_000) {
      return {
        id: channel.id,
        name: channel.name,
        available: false,
        pricePerUnit: 0,
        feesPerUnit: 0,
        profitPerUnit: 0,
        total: 0,
      };
    }

    const feesPct = channel.commission_pct + channel.payment_pct + channel.tax_pct;
    const price = (costBeforeFees + channel.fixed_fee_brl) / (1 - sumCents / 10_000);
    const fees = (price * feesPct) / 100 + channel.fixed_fee_brl;
    const profit = (price * marginPct) / 100;
    return {
      id: channel.id,
      name: channel.name,
      available: true,
      pricePerUnit: round2(price),
      feesPerUnit: round2(fees),
      profitPerUnit: round2(profit),
      // O total usa o preço sem arredondar e arredonda só no fim.
      total: round2(price * quantity),
    };
  });
}

export interface WarningInput {
  energyKwhBrl: number;
  laborHourBrl: number;
  laborMinutes: number;
  powerW: number | null;
  printerPrice: number | null;
  lifespanHours: number | null;
}

export function buildWarnings(w: WarningInput): string[] {
  const warnings: string[] = [];
  if (w.energyKwhBrl === 0) {
    warnings.push("A energia ficou de fora porque o valor do kWh está zerado em Configurações.");
  }
  if (w.powerW === null) {
    warnings.push("A energia ficou de fora porque a máquina não tem consumo informado.");
  }
  if (w.printerPrice === null || w.lifespanHours === null || w.lifespanHours <= 0) {
    warnings.push("O desgaste da máquina ficou de fora. Preencha preço e vida útil em Máquinas.");
  }
  if (w.laborMinutes > 0 && w.laborHourBrl === 0) {
    warnings.push("Seu tempo ficou de fora porque o valor da hora está zerado em Configurações.");
  }
  return warnings;
}
