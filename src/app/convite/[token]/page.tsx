import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { hashInviteToken, TOKEN_PATTERN } from "@/lib/invites";
import { ROLE_LABEL } from "@/lib/permissions";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/tenant";
import { cn } from "@/lib/utils";
import { AcceptButton } from "./accept-button";

// Página pública do convite. Os cabeçalhos no-store e noindex vêm do next.config.ts.
export const metadata = {
  title: "Convite | Voxa3D",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type State =
  | { kind: "invalid" | "expired" | "revoked" | "accepted" | "unavailable" }
  | { kind: "valid"; storeName: string; role: "manager" | "operator"; email: string };

// Mensagens genéricas: nunca revelam outras lojas nem se o e-mail existe.
async function loadState(token: string): Promise<State> {
  if (!TOKEN_PATTERN.test(token)) return { kind: "invalid" };
  if (!hasAdminClient()) {
    console.error("SUPABASE_SERVICE_ROLE_KEY ausente: a página de convite não funciona.");
    return { kind: "unavailable" };
  }

  const admin = createAdminClient();
  const { data: invite, error } = await admin
    .from("tenant_invites")
    .select("tenant_id, email, role, expires_at, accepted_at, revoked_at")
    .eq("token_hash", hashInviteToken(token))
    .maybeSingle();
  if (error) {
    console.error("Erro ao ler convite:", error.code, error.message);
    return { kind: "unavailable" };
  }
  if (!invite) return { kind: "invalid" };
  if (invite.revoked_at !== null) return { kind: "revoked" };
  if (invite.accepted_at !== null) return { kind: "accepted" };
  if (new Date(String(invite.expires_at)).getTime() <= Date.now()) return { kind: "expired" };

  const [{ data: tenant }, { data: profile }] = await Promise.all([
    admin.from("tenants").select("name").eq("id", String(invite.tenant_id)).maybeSingle(),
    admin.from("tenant_profile").select("business_name").eq("tenant_id", String(invite.tenant_id)).maybeSingle(),
  ]);
  return {
    kind: "valid",
    storeName: String(profile?.business_name ?? "").trim() || String(tenant?.name ?? "uma loja"),
    role: invite.role === "manager" ? "manager" : "operator",
    email: String(invite.email),
  };
}

const MESSAGES: Record<Exclude<State["kind"], "valid">, { title: string; text: string }> = {
  invalid: { title: "Convite não encontrado", text: "Confira o link ou peça um novo convite para quem convidou você." },
  expired: { title: "Convite expirado", text: "Este convite passou da validade. Peça um novo convite para quem convidou você." },
  revoked: { title: "Convite cancelado", text: "Este convite foi cancelado. Peça um novo convite para quem convidou você." },
  accepted: { title: "Convite já usado", text: "Este convite já foi aceito. Se for você, entre na sua conta." },
  unavailable: { title: "Não foi possível abrir o convite", text: "Tente novamente em alguns instantes." },
};

export default async function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [state, user] = await Promise.all([loadState(token), getCurrentUser()]);
  const back = encodeURIComponent(`/convite/${token}`);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-6 p-4">
      <Logo className="text-4xl" />
      <Card className="w-full">
        {state.kind !== "valid" ? (
          <>
            <h1 className="text-xl font-extrabold">{MESSAGES[state.kind].title}</h1>
            <p className="mt-2 text-sm text-tinta/70">{MESSAGES[state.kind].text}</p>
            <Link href={user ? "/painel" : "/login"} className={cn(buttonClasses({ variant: "secondary" }), "mt-5 w-full")}>
              {user ? "Ir para o sistema" : "Entrar"}
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-xl font-extrabold [overflow-wrap:anywhere]">
              {state.storeName} convidou você
            </h1>
            <p className="mt-2 text-sm text-tinta/70">
              Você foi convidado para entrar no Voxa3D como <strong>{ROLE_LABEL[state.role]}</strong>.
            </p>

            {!user ? (
              <div className="mt-5 space-y-3">
                <p className="text-sm text-tinta/70">Entre ou crie uma conta com o e-mail do convite.</p>
                <Link href={`/login?next=${back}`} className={cn(buttonClasses({ size: "lg" }), "w-full")}>
                  Entrar
                </Link>
                <Link
                  href={`/cadastro?next=${back}`}
                  className={cn(buttonClasses({ variant: "secondary", size: "lg" }), "w-full")}
                >
                  Criar conta
                </Link>
              </div>
            ) : (user.email ?? "").toLowerCase() !== state.email.toLowerCase() ? (
              <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                Este convite foi enviado para outro e-mail. Entre com o e-mail do convite.
              </p>
            ) : !user.email_confirmed_at ? (
              <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                Confirme o seu e-mail antes de aceitar o convite.
              </p>
            ) : (
              <div className="mt-5">
                <AcceptButton token={token} />
              </div>
            )}
          </>
        )}
      </Card>
    </main>
  );
}
