"use server";

import { revalidatePath } from "next/cache";
import { setActiveTenantCookie } from "@/lib/active-tenant";
import { uuidSchema } from "@/lib/quotes-schema";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/tenant";

// Troca a loja ativa. Autenticação própria: vale para qualquer função, mas só para lojas das
// quais a pessoa é membro (conferido no banco com o cliente dela).
export async function switchTenant(
  tenantId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
  if (!uuidSchema.safeParse(tenantId).success) {
    return { ok: false, message: "Não foi possível trocar de loja." };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) return { ok: false, message: "Não foi possível trocar de loja." };

  await setActiveTenantCookie(tenantId);
  revalidatePath("/", "layout");
  return { ok: true };
}
