"use server";

import { capabilityDenied } from "@/lib/permissions-server";
import { writeBlockedMessage } from "@/lib/billing/guard";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isSoftDeleteEntity, restoreEntity, undoLogEntry, type OpResult } from "@/lib/audit";
import { uuidSchema } from "@/lib/quotes-schema";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant, getCurrentUser } from "@/lib/tenant";

const GENERIC_ERROR = "Não foi possível concluir. Tente novamente.";

const restoreSchema = z.object({
  entity: z.string().refine(isSoftDeleteEntity, "Tipo inválido"),
  id: uuidSchema,
});

// Depois de restaurar ou desfazer, qualquer tela pode ter mudado.
function refreshEverything() {
  revalidatePath("/", "layout");
}

// Tira um item da Lixeira. Sessão e tenant vêm da sessão, nunca do navegador.
export async function restoreItem(entity: string, id: string): Promise<OpResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
  const current = await getCurrentTenant();
  if (!current) return { ok: false, message: "Não encontramos a sua conta." };
  // Permissão da função (Dono, Gerente ou Operador), conferida no servidor.
  const denied = await capabilityDenied("undo_history");
  if (denied) return { ok: false, message: denied };
  // Teste vencido sem assinatura: modo leitura, nada é criado nem editado.
  const blocked = await writeBlockedMessage();
  if (blocked) return { ok: false, message: blocked };

  const parsed = restoreSchema.safeParse({ entity, id });
  if (!parsed.success) return { ok: false, message: GENERIC_ERROR };

  const supabase = await createClient();
  const result = await restoreEntity(
    supabase,
    current.tenant.id,
    parsed.data.entity as Parameters<typeof restoreEntity>[2],
    parsed.data.id,
  );
  if (result.ok) refreshEverything();
  return result;
}

// Desfaz uma entrada do histórico. Só o id do registro vem do navegador.
export async function undoActivity(logId: string): Promise<OpResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
  // Permissão da função (Dono, Gerente ou Operador), conferida no servidor.
  const denied = await capabilityDenied("undo_history");
  if (denied) return { ok: false, message: denied };
  // Teste vencido sem assinatura: modo leitura, nada é criado nem editado.
  const blocked = await writeBlockedMessage();
  if (blocked) return { ok: false, message: blocked };

  const parsed = uuidSchema.safeParse(logId);
  if (!parsed.success) return { ok: false, message: GENERIC_ERROR };

  try {
    const result = await undoLogEntry(parsed.data);
    if (result.ok) refreshEverything();
    return result;
  } catch (error) {
    // Registra só a mensagem do erro, sem dados do usuário.
    console.error("Erro ao desfazer atividade:", error instanceof Error ? error.message : "desconhecido");
    return { ok: false, message: GENERIC_ERROR };
  }
}
