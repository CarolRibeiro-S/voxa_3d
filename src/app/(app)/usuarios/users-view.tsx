"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Copy, Loader2, MailPlus, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { ROLE_DESCRIPTION, ROLE_LABEL, type Role } from "@/lib/permissions";
import {
  changeMemberRole,
  copyInviteLink,
  createInvite,
  removeMember,
  resendInviteEmail,
  revokeInvite,
} from "./actions";

export interface MemberItem {
  userId: string;
  email: string | null;
  name: string | null;
  role: Role;
  since: string;
  isYou: boolean;
}

export interface InviteItem {
  id: string;
  email: string;
  role: "manager" | "operator";
  expiresAt: string;
}

interface UsersViewProps {
  members: MemberItem[];
  invites: InviteItem[];
  max: number;
  canManage: boolean;
  emailEnabled: boolean;
}

type InviteRole = "manager" | "operator";
type Pending =
  | { kind: "role"; member: MemberItem; role: InviteRole }
  | { kind: "remove"; member: MemberItem }
  | { kind: "copy"; invite: InviteItem }
  | { kind: "resend"; invite: InviteItem }
  | { kind: "revoke"; invite: InviteItem }
  | null;

interface ShownLink {
  link: string;
  email: string;
  emailSent: boolean | null;
}

function LinkCard({ shown, onClose }: { shown: ShownLink; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(shown.link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card className="border-violeta bg-nevoa">
      <h2 className="text-sm font-bold uppercase tracking-wide text-violeta-escuro">Link do convite</h2>
      <p className="mt-2 text-sm">
        Convite para <strong className="[overflow-wrap:anywhere]">{shown.email}</strong>. Este link
        aparece só agora: copie e envie para o usuário. Ele vale por 7 dias.
      </p>
      {shown.emailSent === true && (
        <p role="status" className="mt-2 text-sm font-medium text-green-700">
          Também enviamos o convite por e-mail.
        </p>
      )}
      {shown.emailSent === false && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          Não foi possível enviar o e-mail. Copie o link e envie você mesmo.
        </p>
      )}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input readOnly value={shown.link} aria-label="Link do convite" onFocus={(e) => e.currentTarget.select()} />
        <Button className="shrink-0" onClick={() => void copy()}>
          {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          {copied ? "Copiado" : "Copiar link"}
        </Button>
      </div>
      <Button variant="ghost" size="sm" className="mt-2" onClick={onClose}>
        Fechar
      </Button>
    </Card>
  );
}

export function UsersView({ members, invites, max, canManage, emailEnabled }: UsersViewProps) {
  const used = members.length + invites.length;
  const full = used >= max;

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("operator");
  const [sendEmail, setSendEmail] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [shown, setShown] = useState<ShownLink | null>(null);
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<Pending>(null);

  function submitInvite() {
    setFormError(null);
    startTransition(async () => {
      const result = await createInvite({ email, role, sendEmail: emailEnabled && sendEmail });
      if (result.ok) {
        setShown({ link: result.link, email: result.email, emailSent: result.emailSent });
        setEmail("");
      } else {
        setFormError(result.message);
      }
    });
  }

  // Textos de cada confirmação.
  const dialog = (() => {
    if (!action) return null;
    switch (action.kind) {
      case "role":
        return {
          title: "Trocar a função?",
          description: `${action.member.email ?? "Este usuário"} passa a ser ${ROLE_LABEL[action.role]}. ${ROLE_DESCRIPTION[action.role]}`,
          confirmLabel: "Trocar função",
          danger: false,
        };
      case "remove":
        return {
          title: "Remover usuário?",
          description: `${action.member.email ?? "Este usuário"} perde o acesso à loja. O que ela criou continua na loja.`,
          confirmLabel: "Remover usuário",
          danger: true,
        };
      case "copy":
        return {
          title: "Gerar um novo link?",
          description: `Um novo link do convite de ${action.invite.email} será criado e o link anterior deixa de funcionar.`,
          confirmLabel: "Gerar link",
          danger: false,
        };
      case "resend":
        return {
          title: "Reenviar o e-mail?",
          description: `Um novo link será enviado para ${action.invite.email} e o link anterior deixa de funcionar.`,
          confirmLabel: "Reenviar e-mail",
          danger: false,
        };
      case "revoke":
        return {
          title: "Revogar o convite?",
          description: `O convite de ${action.invite.email} deixa de valer.`,
          confirmLabel: "Revogar convite",
          danger: true,
        };
    }
  })();

  async function confirmAction() {
    if (!action) return { ok: false as const, message: "Nada para fazer." };
    switch (action.kind) {
      case "role":
        return changeMemberRole(action.member.userId, action.role);
      case "remove":
        return removeMember(action.member.userId);
      case "revoke":
        return revokeInvite(action.invite.id);
      case "copy":
      case "resend": {
        const result =
          action.kind === "copy"
            ? await copyInviteLink(action.invite.id)
            : await resendInviteEmail(action.invite.id);
        if (!result.ok) return result;
        setShown({ link: result.link, email: result.email, emailSent: result.emailSent });
        return { ok: true as const };
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-tinta">Usuários</h1>
        <p className="mt-1 text-sm text-tinta/70">Quem usa a sua loja no Voxa3D.</p>
      </div>

      <Card data-tour="usuarios-contador" className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-extrabold">
            {used} de {max} {max === 1 ? "usuário" : "usuários"}
          </p>
          <p className="text-sm text-tinta/70">
            {canManage && full
              ? `Seu plano inclui ${max} ${max === 1 ? "usuário" : "usuários"}. Conheça o plano Loja para convidar mais usuários.`
              : "Conta os usuários e os convites pendentes."}
          </p>
        </div>
        {canManage &&
          (full ? (
            <Link href="/assinatura" data-tour="usuarios-convidar" className={buttonClasses({})}>
              <UserPlus size={16} aria-hidden="true" />
              Convidar usuário
            </Link>
          ) : (
            <a href="#convidar-usuario" data-tour="usuarios-convidar" className={buttonClasses({})}>
              <UserPlus size={16} aria-hidden="true" />
              Convidar usuário
            </a>
          ))}
      </Card>

      {shown && <LinkCard shown={shown} onClose={() => setShown(null)} />}

      <Card>
        <h2 className="text-sm font-bold uppercase tracking-wide text-violeta-escuro">Usuários</h2>
        <ul className="mt-3 divide-y divide-violeta/10">
          {members.map((m) => (
            <li key={m.userId} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold [overflow-wrap:anywhere]">
                    {m.name ?? m.email ?? "Usuário"}
                    {m.isYou && <span className="ml-2 text-xs font-normal text-tinta/60">(você)</span>}
                  </p>
                  {m.name && m.email && (
                    <p className="text-sm text-tinta/70 [overflow-wrap:anywhere]">{m.email}</p>
                  )}
                  <p className="text-xs text-tinta/60">Desde {formatDate(m.since)}</p>
                </div>
                <Badge variant={m.role === "owner" ? "highlight" : "default"}>{ROLE_LABEL[m.role]}</Badge>
              </div>
              {canManage && m.role !== "owner" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setAction({ kind: "role", member: m, role: m.role === "manager" ? "operator" : "manager" })
                    }
                  >
                    Trocar para {ROLE_LABEL[m.role === "manager" ? "operator" : "manager"]}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-700 hover:bg-red-50"
                    onClick={() => setAction({ kind: "remove", member: m })}
                  >
                    Remover
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {invites.length > 0 && (
        <Card>
          <h2 className="text-sm font-bold uppercase tracking-wide text-violeta-escuro">
            Convites pendentes
          </h2>
          <ul className="mt-3 divide-y divide-violeta/10">
            {invites.map((i) => (
              <li key={i.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold [overflow-wrap:anywhere]">{i.email}</p>
                    <p className="text-xs text-tinta/60">Vale até {formatDate(i.expiresAt)}</p>
                  </div>
                  <Badge>{ROLE_LABEL[i.role]}</Badge>
                </div>
                {canManage && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setAction({ kind: "copy", invite: i })}>
                      Copiar link
                    </Button>
                    {emailEnabled && (
                      <Button variant="secondary" size="sm" onClick={() => setAction({ kind: "resend", invite: i })}>
                        Reenviar e-mail
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-700 hover:bg-red-50"
                      onClick={() => setAction({ kind: "revoke", invite: i })}
                    >
                      Revogar
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {canManage && !full && (
          <Card id="convidar-usuario" className="scroll-mt-6">
            <h2 className="text-lg font-extrabold">Convidar usuário</h2>
            <form
              className="mt-4 space-y-4"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                submitInvite();
              }}
            >
              <FormField id="invite-email" label="E-mail do usuário" error={formError ?? undefined}>
                {(a) => (
                  <Input
                    id={a.id}
                    type="email"
                    autoComplete="off"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    invalid={a.invalid}
                    aria-describedby={a.describedBy}
                  />
                )}
              </FormField>

              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">Função</legend>
                <div className="space-y-2">
                  {(["manager", "operator"] as const).map((r) => (
                    <label
                      key={r}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border border-violeta/20 p-3 text-sm has-[:checked]:border-violeta has-[:checked]:bg-nevoa"
                    >
                      <input
                        type="radio"
                        name="invite-role"
                        value={r}
                        checked={role === r}
                        onChange={() => setRole(r)}
                        className="mt-0.5 size-4 accent-violeta"
                      />
                      <span>
                        <span className="block font-semibold">{ROLE_LABEL[r]}</span>
                        <span className="text-tinta/70">{ROLE_DESCRIPTION[r]}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {emailEnabled && (
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="size-5 accent-violeta"
                  />
                  Enviar o convite por e-mail
                </label>
              )}

              <Button type="submit" disabled={pending || email.trim() === ""} className="w-full sm:w-auto">
                {pending ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                ) : (
                  <MailPlus size={16} aria-hidden="true" />
                )}
                Gerar convite
              </Button>
            </form>
          </Card>
      )}

      <Card data-tour="usuarios-funcoes">
        <h2 className="text-sm font-bold uppercase tracking-wide text-violeta-escuro">Funções</h2>
        <dl className="mt-3 space-y-3 text-sm">
          {(["owner", "manager", "operator"] as const).map((r) => (
            <div key={r}>
              <dt className="font-semibold">{ROLE_LABEL[r]}</dt>
              <dd className="text-tinta/70">{ROLE_DESCRIPTION[r]}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <ConfirmDialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open) setAction(null);
        }}
        title={dialog?.title ?? ""}
        description={dialog?.description ?? ""}
        confirmLabel={dialog?.confirmLabel ?? "Confirmar"}
        variant={dialog?.danger ? "danger" : "default"}
        onConfirm={confirmAction}
      />
    </div>
  );
}
