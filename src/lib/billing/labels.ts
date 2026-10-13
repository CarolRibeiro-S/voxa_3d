import { daysUntil } from "@/lib/format";
import type { AccessStatus } from "@/lib/billing/access-types";

// Textos de status da conta. Sem imports de servidor.

export const ACCESS_STATUS_LABEL: Record<AccessStatus, string> = {
  trialing: "Em teste grátis",
  active: "Assinatura ativa",
  readonly: "Modo leitura",
};

// Dias restantes do teste, nunca negativos.
export function trialDaysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  return Math.max(0, daysUntil(trialEndsAt));
}

export function daysLeftText(days: number): string {
  if (days <= 0) return "Seu teste termina hoje";
  if (days === 1) return "Falta 1 dia do seu teste grátis";
  return `Faltam ${days} dias do seu teste grátis`;
}
