import "server-only";
import { redirect } from "next/navigation";
import {
  can,
  homePathFor,
  PERMISSION_DENIED_MESSAGE,
  type Capability,
  type Role,
} from "@/lib/permissions";
import { getCurrentTenant } from "@/lib/tenant";

export class PermissionError extends Error {
  constructor() {
    super(PERMISSION_DENIED_MESSAGE);
    this.name = "PermissionError";
  }
}

// Confere no servidor, a cada chamada, a função da pessoa na loja ativa. Lança PermissionError
// ("Você não tem permissão para fazer isso.") quando a função não tem a capacidade.
export async function requireCapability(
  capability: Capability,
): Promise<{ tenantId: string; role: Role }> {
  const current = await getCurrentTenant();
  if (!current || !can(current.role, capability)) throw new PermissionError();
  return { tenantId: current.tenant.id, role: current.role };
}

// Para Server Actions que devolvem { ok: false, message }: a mensagem de recusa, ou null.
export async function capabilityDenied(capability: Capability): Promise<string | null> {
  try {
    await requireCapability(capability);
    return null;
  } catch (error) {
    if (error instanceof PermissionError) return error.message;
    throw error;
  }
}

// Para páginas: sem a capacidade, redireciona para a página inicial da função (nunca erro técnico).
export function guardPage(role: Role, capability: Capability): void {
  if (!can(role, capability)) redirect(homePathFor(role));
}
