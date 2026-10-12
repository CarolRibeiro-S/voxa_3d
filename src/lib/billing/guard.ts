import "server-only";
import { READ_ONLY_MESSAGE } from "@/lib/billing/access";
import { getCurrentTenant } from "@/lib/tenant";

// Para Server Actions que criam ou editam dados. Devolve a mensagem de bloqueio quando a conta
// está em modo leitura (teste vencido sem assinatura), ou null quando pode gravar.
export async function writeBlockedMessage(): Promise<string | null> {
  const current = await getCurrentTenant();
  return current?.access.readOnly ? READ_ONLY_MESSAGE : null;
}
