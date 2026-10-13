"use server";

import { redirect } from "next/navigation";
import { setActiveTenantCookie } from "@/lib/active-tenant";
import { countSeats, getMaxUsers, hashInviteToken, TOKEN_PATTERN } from "@/lib/invites";
import { homePathFor, normalizeRole } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/tenant";
import { normalizePlan } from "@/lib/plans";

export type AcceptResult = { ok: false; message: string };

const GENERIC = "Não foi possível aceitar o convite agora. Tente novamente.";

// Aceita o convite no servidor com o cliente admin. O usuário precisa estar logado, com e-mail
// verificado e igual ao do convite. Nada vem do navegador além do token.
export async function acceptInvite(token: string): Promise<AcceptResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Entre na sua conta para aceitar o convite." };
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) {
    return { ok: false, message: "Este convite não está disponível." };
  }

  const admin = createAdminClient();
  const { data: invite, error } = await admin
    .from("tenant_invites")
    .select("id, tenant_id, email, role, expires_at, accepted_at, revoked_at")
    .eq("token_hash", hashInviteToken(token))
    .maybeSingle();
  if (error) {
    console.error("Erro ao ler convite:", error.code, error.message);
    return { ok: false, message: GENERIC };
  }
  if (
    !invite ||
    invite.accepted_at !== null ||
    invite.revoked_at !== null ||
    new Date(String(invite.expires_at)).getTime() <= Date.now()
  ) {
    return { ok: false, message: "Este convite não está disponível." };
  }

  if (!user.email_confirmed_at) {
    return { ok: false, message: "Confirme o seu e-mail antes de aceitar o convite." };
  }
  if ((user.email ?? "").toLowerCase() !== String(invite.email).toLowerCase()) {
    return { ok: false, message: "Este convite foi enviado para outro e-mail. Entre com o e-mail do convite." };
  }

  const tenantId = String(invite.tenant_id);
  const role = invite.role === "manager" ? "manager" : "operator";

  // Já é membro: só informa e usa essa loja.
  const { data: already } = await admin
    .from("tenant_members")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (already) {
    await setActiveTenantCookie(tenantId);
    return { ok: false, message: "Você já faz parte desta loja." };
  }

  // Limite de usuários do plano da loja, conferido de novo (este convite já ocupa uma vaga).
  const { data: sub } = await admin
    .from("subscriptions")
    .select("plan_code")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const [max, seats] = await Promise.all([
    getMaxUsers(normalizePlan(sub?.plan_code as string | null | undefined)),
    countSeats(admin, tenantId, String(invite.id)),
  ]);
  if (seats >= max) {
    return { ok: false, message: "Esta loja atingiu o limite de usuários do plano. Fale com quem convidou." };
  }

  // Reserva o convite primeiro: o UPDATE só vale se ainda não foi aceito, então dois cliques
  // ao mesmo tempo não criam duas participações.
  const { data: claimed, error: claimError } = await admin
    .from("tenant_invites")
    .update({ accepted_at: new Date().toISOString(), accepted_by: user.id })
    .eq("id", String(invite.id))
    .is("accepted_at", null)
    .is("revoked_at", null)
    .select("id");
  if (claimError || !claimed || claimed.length === 0) {
    return { ok: false, message: "Este convite não está disponível." };
  }

  const { error: memberError } = await admin
    .from("tenant_members")
    .insert({ tenant_id: tenantId, user_id: user.id, role });
  if (memberError) {
    console.error("Erro ao criar participação:", memberError.code, memberError.message);
    // Devolve o convite para poder tentar de novo.
    await admin
      .from("tenant_invites")
      .update({ accepted_at: null, accepted_by: null })
      .eq("id", String(invite.id));
    return { ok: false, message: GENERIC };
  }

  await setActiveTenantCookie(tenantId);
  redirect(homePathFor(normalizeRole(role)));
}
