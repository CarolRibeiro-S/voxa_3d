"use server";

import { capabilityDenied } from "@/lib/permissions-server";
import { writeBlockedMessage } from "@/lib/billing/guard";
import { hourlyRateSchema, type HourlyRateInput } from "@/lib/hourly-rate-schema";
import { getCurrentTenant, getCurrentUser } from "@/lib/tenant";

export type HourlyRateResult = { ok: true; value: number } | { ok: false; message: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

// Quanto cobrar pela hora. A conta roda aqui, no servidor, e só o resultado volta ao navegador.
export async function calculateHourlyRate(input: HourlyRateInput): Promise<HourlyRateResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
  const current = await getCurrentTenant();
  if (!current) return { ok: false, message: "Não encontramos a sua conta." };
  // Permissão da função (Dono, Gerente ou Operador), conferida no servidor.
  const denied = await capabilityDenied("view_dashboard");
  if (denied) return { ok: false, message: denied };
  // Teste vencido sem assinatura: modo leitura.
  const blocked = await writeBlockedMessage();
  if (blocked) return { ok: false, message: blocked };

  const parsed = hourlyRateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Confira os valores informados." };
  }
  const v = parsed.data;

  // valor da hora = ganho do mês / (horas por semana x 4,33 semanas x % de tempo produtivo)
  const productiveHours = v.hours_per_week * 4.33 * (v.productive_pct / 100);
  return { ok: true, value: round2(v.monthly_goal_brl / productiveHours) };
}
