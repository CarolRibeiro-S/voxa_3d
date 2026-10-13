import "server-only";
import type { LaunchLevel } from "@/lib/billing/launch-types";
import { createAdminClient } from "@/lib/supabase/admin";

// Até este número de vagas restantes o destaque vira "últimas vagas". O número em si nunca é
// mostrado nem enviado ao navegador: só o nível (a string) sai daqui.
export const LAST_SPOTS_THRESHOLD = 10;

// Vagas restantes, lidas com o cliente ADMIN (service role). null quando não foi possível saber.
async function fetchRemaining(): Promise<number | null> {
  try {
    const { data, error } = await createAdminClient().rpc("launch_remaining");
    if (error) {
      console.error("Erro em launch_remaining:", error.code, error.message);
      return null;
    }
    const raw = Array.isArray(data) ? data[0] : data;
    const n = typeof raw === "string" ? Number(raw) : raw;
    return typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : null;
  } catch (error) {
    console.error("Erro ao consultar as vagas de lançamento:", error instanceof Error ? error.message : "desconhecido");
    return null;
  }
}

// Nunca assume "esgotado" nem "aberto" quando não sabe: nesse caso devolve 'hidden'.
export async function getLaunchLevel(): Promise<LaunchLevel> {
  const remaining = await fetchRemaining();
  if (remaining === null) return "hidden";
  if (remaining <= 0) return "soldout";
  return remaining <= LAST_SPOTS_THRESHOLD ? "last" : "open";
}
