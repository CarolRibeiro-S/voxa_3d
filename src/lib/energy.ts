import "server-only";
import { z } from "zod";
import {
  energyGroupSchema,
  type EnergyDistributor,
  type EnergyGroup,
  type EnergyTariff,
} from "@/lib/energy-schema";
import { createClient } from "@/lib/supabase/server";

// Catálogo global de tarifas: só pelas RPCs protegidas, uma consulta por vez, com a sessão do
// usuário (elas são VOLATILE e gravam o controle de limite). Nunca listar todas as tarifas.

export class EnergyLookupError extends Error {
  constructor(public readonly kind: "limit" | "generic" | "not_found") {
    super(kind);
  }
}

// Só o limite de consultas vira aviso de limite. O resto é erro genérico, registrado no servidor.
function lookupError(context: string, error: { code?: string; message?: string }) {
  if (error.code === "P0001" || (error.message ?? "").includes("Limite de consultas atingido")) {
    return new EnergyLookupError("limit");
  }
  // Registra só o código e a mensagem do erro, sem dados do usuário.
  console.error(`Erro na RPC de energia (${context}):`, error.code, error.message);
  return new EnergyLookupError("generic");
}

const distributorSchema = z.object({
  id: z.string(),
  name: z.string(),
  state: z.string(),
});

export async function listEnergyDistributors(): Promise<EnergyDistributor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("energy_list_distributors");
  if (error) throw lookupError("listar", error);

  const parsed = z.array(distributorSchema).safeParse(data);
  if (!parsed.success) {
    console.error("Retorno inesperado de energy_list_distributors");
    throw new EnergyLookupError("generic");
  }

  // Devolve só id, nome e estado, ordenados por estado e depois por nome.
  return parsed.data
    .map(({ id, name, state }) => ({ id, name, state }))
    .sort(
      (a, b) =>
        a.state.localeCompare(b.state, "pt-BR") || a.name.localeCompare(b.name, "pt-BR"),
    );
}

const tariffSchema = z.object({
  distributor_name: z.string(),
  state: z.string(),
  tariff_group: energyGroupSchema,
  kwh_brl: z.coerce.number().finite().min(0),
  valid_to: z.string().nullish(),
  expired: z.boolean().nullish(),
  estimated_taxes: z.boolean().nullish(),
});

export async function getEnergyTariff(
  distributorId: string,
  group: EnergyGroup,
): Promise<EnergyTariff> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("energy_get_tariff", {
    p_distributor_id: distributorId,
    p_group: group,
  });
  if (error) throw lookupError("tarifa", error);

  // A função pode devolver um objeto ou uma lista com um item.
  const row: unknown = Array.isArray(data) ? data[0] : data;
  if (row === null || row === undefined) throw new EnergyLookupError("not_found");

  const parsed = tariffSchema.safeParse(row);
  if (!parsed.success) {
    console.error("Retorno inesperado de energy_get_tariff");
    throw new EnergyLookupError("generic");
  }
  const t = parsed.data;
  return {
    distributorName: t.distributor_name,
    state: t.state,
    group: t.tariff_group,
    kwhBrl: t.kwh_brl,
    validTo: t.valid_to ?? null,
    expired: t.expired === true,
    estimatedTaxes: t.estimated_taxes === true,
  };
}
