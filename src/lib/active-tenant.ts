import "server-only";
import { cookies } from "next/headers";
import { ACTIVE_TENANT_COOKIE } from "@/lib/tenant";

// Grava o cookie da loja ativa. Ele só diz qual loja a pessoa quer ver: o servidor confere a
// participação a cada requisição (getCurrentTenant). Só pode ser chamado de Server Action ou
// route handler.
export async function setActiveTenantCookie(tenantId: string) {
  (await cookies()).set(ACTIVE_TENANT_COOKIE, tenantId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
