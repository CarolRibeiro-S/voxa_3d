import { z } from "zod";

// Compartilhado entre cliente e servidor: só tipos, rótulos e validação. Sem imports de servidor.

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ENERGY_GROUPS = ["B1", "B3"] as const;
export type EnergyGroup = (typeof ENERGY_GROUPS)[number];

export const ENERGY_GROUP_LABEL: Record<EnergyGroup, string> = {
  B1: "Residencial (B1)",
  B3: "Comercial (B3)",
};

export const energyGroupSchema = z.enum(ENERGY_GROUPS, { error: "Escolha o tipo de ligação" });

export const energyDistributorIdSchema = z
  .string()
  .regex(UUID_PATTERN, "Distribuidora inválida");

export const energyTariffInputSchema = z.object({
  distributorId: energyDistributorIdSchema,
  group: energyGroupSchema,
});
export type EnergyTariffInput = z.input<typeof energyTariffInputSchema>;

export interface EnergyDistributor {
  id: string;
  name: string;
  state: string;
}

export interface EnergyTariff {
  distributorName: string;
  state: string;
  group: EnergyGroup;
  kwhBrl: number;
  validTo: string | null;
  expired: boolean;
  estimatedTaxes: boolean;
}

export type EnergyActionResult<T> = { ok: true; data: T } | { ok: false; error: string };
