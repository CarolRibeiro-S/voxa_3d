"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeBlockedMessage } from "@/lib/billing/guard";
import { sendInviteEmail } from "@/lib/email";
import {
  countSeats,
  emailSendingEnabled,
  generateInviteToken,
  getMaxUsers,
  hashInviteToken,
  inviteExpiry,
  inviteLink,
  INVITES_PER_HOUR,
  listTeamMembers,
} from "@/lib/invites";
import { ROLE_LABEL } from "@/lib/permissions";
import { capabilityDenied } from "@/lib/permissions-server";
import { uuidSchema } from "@/lib/quotes-schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenant, getCurrentUser, getTenantProfile } from "@/lib/tenant";

export type TeamActionResult = { ok: true } | { ok: false; message: string };
export type InviteLinkResult =
  | { ok: true; link: string; email: string; emailSent: boolean | null }
  | { ok: false; message: string };

const GENERIC_ERROR = "Não foi possível concluir. Tente novamente.";

const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Informe o e-mail")
    .max(254, "E-mail muito longo")
    .email("Informe um e-mail válido"),
  role: z.enum(["manager", "operator"], { error: "Escolha a função" }),
  sendEmail: z.boolean().default(false),
});
export type InviteInput = z.input<typeof inviteSchema>;

const memberRoleSchema = z.enum(["manager", "operator"], { error: "Escolha a função" });

interface OwnerContext {
  tenantId: string;
  userId: string;
  storeName: string;
  plan: Parameters<typeof getMaxUsers>[0];
}

// Só o Dono da loja ativa, com a assinatura fora do modo leitura.
async function requireOwner(): Promise<{ ok: true; ctx: OwnerContext } | { ok: false; message: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
  const current = await getCurrentTenant();
  if (!current) return { ok: false, message: "Não encontramos a sua conta." };
  const denied = await capabilityDenied("manage_users");
  if (denied) return { ok: false, message: denied };
  const blocked = await writeBlockedMessage();
  if (blocked) return { ok: false, message: blocked };

  const profile = await getTenantProfile(current.tenant.id);
  return {
    ok: true,
    ctx: {
      tenantId: current.tenant.id,
      userId: user.id,
      storeName: profile?.business_name?.trim() || current.tenant.name,
      plan: current.tenant.plan,
    },
  };
}

function fail(context: string, error: { code?: string; message?: string }): TeamActionResult {
  // Registra só o código e a mensagem do erro, nunca o token nem o link.
  console.error(`Erro em usuários (${context}):`, error.code, error.message);
  return { ok: false, message: GENERIC_ERROR };
}

async function tryEmail(
  ctx: OwnerContext,
  to: string,
  role: "manager" | "operator",
  link: string,
): Promise<boolean> {
  const result = await sendInviteEmail({ to, storeName: ctx.storeName, roleLabel: ROLE_LABEL[role], link });
  return result.ok;
}

export async function createInvite(input: InviteInput): Promise<InviteLinkResult> {
  const g = await requireOwner();
  if (!g.ok) return g;
  const { ctx } = g;
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Confira os valores informados." };
  }
  const { email, role, sendEmail } = parsed.data;

  const admin = createAdminClient();
  try {
    // Limite do plano: membros mais convites pendentes.
    const [max, seats] = await Promise.all([getMaxUsers(ctx.plan), countSeats(admin, ctx.tenantId)]);
    if (seats >= max) {
      return {
        ok: false,
        message: `Seu plano inclui ${max} ${max === 1 ? "usuário" : "usuários"}. Conheça o plano Loja para convidar mais pessoas.`,
      };
    }

    // No máximo 20 convites criados por loja por hora.
    const since = new Date(Date.now() - 3_600_000).toISOString();
    const { count } = await admin
      .from("tenant_invites")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .gte("created_at", since);
    if ((count ?? 0) >= INVITES_PER_HOUR) {
      return { ok: false, message: "Você criou muitos convites nesta hora. Tente novamente mais tarde." };
    }

    // Já é usuário da loja, ou já tem convite pendente?
    const members = await listTeamMembers(admin, ctx.tenantId);
    if (members.some((m) => m.email?.toLowerCase() === email)) {
      return { ok: false, message: "Este usuário já faz parte da loja." };
    }
    const { data: existing } = await admin
      .from("tenant_invites")
      .select("id")
      .eq("tenant_id", ctx.tenantId)
      .eq("email", email)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .limit(1);
    if (existing && existing.length > 0) {
      return { ok: false, message: "Já existe um convite pendente para este e-mail." };
    }

    // O token só existe aqui: no banco vai apenas o hash.
    const token = generateInviteToken();
    const { error } = await admin.from("tenant_invites").insert({
      tenant_id: ctx.tenantId,
      email,
      role,
      token_hash: hashInviteToken(token),
      invited_by: ctx.userId,
      expires_at: inviteExpiry(),
    });
    if (error) {
      console.error("Erro ao criar convite:", error.code, error.message);
      return { ok: false, message: GENERIC_ERROR };
    }

    const link = await inviteLink(token);
    const emailSent = sendEmail && emailSendingEnabled() ? await tryEmail(ctx, email, role, link) : null;
    revalidatePath("/usuarios");
    return { ok: true, link, email, emailSent };
  } catch (error) {
    console.error("Erro ao convidar:", error instanceof Error ? error.message : "desconhecido");
    return { ok: false, message: GENERIC_ERROR };
  }
}

interface InviteRow {
  id: string;
  email: string;
  role: "manager" | "operator";
}

// Convite pendente desta loja.
async function loadPendingInvite(tenantId: string, inviteId: string): Promise<InviteRow | null> {
  const { data } = await createAdminClient()
    .from("tenant_invites")
    .select("id, email, role")
    .eq("id", inviteId)
    .eq("tenant_id", tenantId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .maybeSingle();
  return data
    ? { id: String(data.id), email: String(data.email), role: data.role === "manager" ? "manager" : "operator" }
    : null;
}

// Gera um novo link (o anterior deixa de funcionar), pois o token antigo não é guardado.
async function rotateToken(
  ctx: OwnerContext,
  inviteId: string,
  sendEmail: boolean,
): Promise<InviteLinkResult> {
  if (!uuidSchema.safeParse(inviteId).success) return { ok: false, message: GENERIC_ERROR };
  const invite = await loadPendingInvite(ctx.tenantId, inviteId);
  if (!invite) return { ok: false, message: "Este convite não está mais disponível." };

  const token = generateInviteToken();
  const { data, error } = await createAdminClient()
    .from("tenant_invites")
    .update({ token_hash: hashInviteToken(token), expires_at: inviteExpiry() })
    .eq("id", inviteId)
    .eq("tenant_id", ctx.tenantId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .select("id");
  if (error || !data || data.length === 0) {
    console.error("Erro ao renovar convite:", error?.code, error?.message);
    return { ok: false, message: GENERIC_ERROR };
  }

  const link = await inviteLink(token);
  const emailSent = sendEmail && emailSendingEnabled() ? await tryEmail(ctx, invite.email, invite.role, link) : null;
  revalidatePath("/usuarios");
  return { ok: true, link, email: invite.email, emailSent };
}

export async function copyInviteLink(inviteId: string): Promise<InviteLinkResult> {
  const g = await requireOwner();
  if (!g.ok) return g;
  return rotateToken(g.ctx, inviteId, false);
}

export async function resendInviteEmail(inviteId: string): Promise<InviteLinkResult> {
  const g = await requireOwner();
  if (!g.ok) return g;
  if (!emailSendingEnabled()) return { ok: false, message: "O envio de e-mail não está configurado." };
  return rotateToken(g.ctx, inviteId, true);
}

export async function revokeInvite(inviteId: string): Promise<TeamActionResult> {
  const g = await requireOwner();
  if (!g.ok) return g;
  if (!uuidSchema.safeParse(inviteId).success) return { ok: false, message: GENERIC_ERROR };

  const { data, error } = await createAdminClient()
    .from("tenant_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId)
    .eq("tenant_id", g.ctx.tenantId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .select("id");
  if (error || !data || data.length === 0) return fail("revogar", error ?? {});

  revalidatePath("/usuarios");
  return { ok: true };
}

// O Dono não muda de função aqui, e a loja nunca fica sem Dono.
async function targetMember(ctx: OwnerContext, userId: string) {
  if (!uuidSchema.safeParse(userId).success) return null;
  const { data } = await createAdminClient()
    .from("tenant_members")
    .select("user_id, role")
    .eq("tenant_id", ctx.tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  return data ? { userId: String(data.user_id), role: String(data.role) } : null;
}

export async function changeMemberRole(userId: string, role: "manager" | "operator"): Promise<TeamActionResult> {
  const g = await requireOwner();
  if (!g.ok) return g;
  const parsedRole = memberRoleSchema.safeParse(role);
  if (!parsedRole.success) return { ok: false, message: parsedRole.error.issues[0]?.message ?? GENERIC_ERROR };

  const target = await targetMember(g.ctx, userId);
  if (!target) return { ok: false, message: GENERIC_ERROR };
  if (target.role === "owner") return { ok: false, message: "A função do Dono não pode ser alterada." };

  const { data, error } = await createAdminClient()
    .from("tenant_members")
    .update({ role: parsedRole.data })
    .eq("tenant_id", g.ctx.tenantId)
    .eq("user_id", target.userId)
    .neq("role", "owner")
    .select("user_id");
  if (error || !data || data.length === 0) return fail("trocar função", error ?? {});

  revalidatePath("/usuarios");
  return { ok: true };
}

export async function removeMember(userId: string): Promise<TeamActionResult> {
  const g = await requireOwner();
  if (!g.ok) return g;

  const target = await targetMember(g.ctx, userId);
  if (!target) return { ok: false, message: GENERIC_ERROR };
  if (target.role === "owner" || target.userId === g.ctx.userId) {
    return { ok: false, message: "O Dono não pode se remover nem deixar a loja sem Dono." };
  }

  // Remover um usuário encerra o acesso: tenant_members não tem deleted_at, então é a única
  // exclusão real do sistema. Os dados criados pelo usuário continuam na loja.
  const { error } = await createAdminClient()
    .from("tenant_members")
    .delete()
    .eq("tenant_id", g.ctx.tenantId)
    .eq("user_id", target.userId)
    .neq("role", "owner");
  if (error) return fail("remover", error);

  revalidatePath("/usuarios");
  return { ok: true };
}
