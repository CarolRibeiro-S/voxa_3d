import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Plan } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

// Convites e usuários. Tudo aqui roda no servidor e as gravações usam o cliente admin (service
// role), depois que quem chama foi conferido como Dono da loja ativa.
//
// Colunas (migrations 024 e 025):
// tenant_members: tenant_id, user_id, role ('owner', 'manager', 'operator'), permissions, created_at
// tenant_invites: id, tenant_id, email, role, token_hash, invited_by, expires_at, accepted_at,
//                 accepted_by, revoked_at, created_at
// plans:          max_users (Pro 1, Loja 3)

export const INVITE_TTL_DAYS = 7;
export const INVITES_PER_HOUR = 20;
const DAY_MS = 86_400_000;

// Token do convite: 32 bytes aleatórios em base64url (43 caracteres). Só o hash é guardado.
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const inviteExpiry = () => new Date(Date.now() + INVITE_TTL_DAYS * DAY_MS).toISOString();

// Endereço do site: NEXT_PUBLIC_SITE_URL, ou o endereço da própria requisição.
export async function siteBaseUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function inviteLink(token: string): Promise<string> {
  return `${await siteBaseUrl()}/convite/${token}`;
}

export const emailSendingEnabled = () =>
  Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);

// Quantos usuários o plano inclui (plans.max_users). Sem resposta, assume 1 (o menor).
export async function getMaxUsers(plan: Plan): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("plans").select("max_users").eq("code", plan).maybeSingle();
  if (error) console.error("Erro ao ler plans.max_users:", error.code, error.message);
  const n = Number(data?.max_users);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export interface PendingInvite {
  id: string;
  email: string;
  role: "manager" | "operator";
  expiresAt: string;
  createdAt: string;
}

export async function listPendingInvites(admin: SupabaseClient, tenantId: string): Promise<PendingInvite[]> {
  const { data, error } = await admin
    .from("tenant_invites")
    .select("id, email, role, expires_at, created_at")
    .eq("tenant_id", tenantId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw new Error("Não foi possível carregar os convites.");
  return (data ?? []).map((row) => ({
    id: String(row.id),
    email: String(row.email),
    role: row.role === "manager" ? "manager" : "operator",
    expiresAt: String(row.expires_at),
    createdAt: String(row.created_at),
  }));
}

export interface TeamMember {
  userId: string;
  role: string;
  since: string;
  email: string | null;
  name: string | null;
}

// Pessoas da loja, com e-mail e nome buscados no Auth (cliente admin).
export async function listTeamMembers(admin: SupabaseClient, tenantId: string): Promise<TeamMember[]> {
  const { data, error } = await admin
    .from("tenant_members")
    .select("user_id, role, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });
  if (error) throw new Error("Não foi possível carregar os usuários.");

  return Promise.all(
    (data ?? []).map(async (row) => {
      const { data: found } = await admin.auth.admin.getUserById(String(row.user_id));
      const meta = found?.user?.user_metadata as Record<string, unknown> | undefined;
      const name = [meta?.full_name, meta?.name].find((v): v is string => typeof v === "string" && v.trim() !== "");
      return {
        userId: String(row.user_id),
        role: String(row.role),
        since: String(row.created_at),
        email: found?.user?.email ?? null,
        name: name ?? null,
      };
    }),
  );
}

// Vagas ocupadas: membros mais convites pendentes (menos o convite informado, se houver).
export async function countSeats(
  admin: SupabaseClient,
  tenantId: string,
  excludeInviteId?: string,
): Promise<number> {
  const [members, invites] = await Promise.all([
    admin.from("tenant_members").select("user_id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    listPendingInvites(admin, tenantId),
  ]);
  if (members.error) throw new Error("Não foi possível contar os usuários.");
  const pending = invites.filter((i) => i.id !== excludeInviteId).length;
  return (members.count ?? 0) + pending;
}
