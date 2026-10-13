"use client";

import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import type { AccessNotice, AccessStatus } from "@/lib/billing/access-types";
import { daysLeftText } from "@/lib/billing/labels";
import { cn } from "@/lib/utils";

interface TrialBannerProps {
  status: AccessStatus;
  daysLeft: number | null;
  notice: AccessNotice | null;
  // Só quem pode ver a Assinatura (o Dono) recebe o botão.
  showButton: boolean;
}

// DD/MM no fuso de São Paulo.
const dayMonth = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));

interface Message {
  text: string;
  button: string;
  warning: boolean;
}

function messageFor(status: AccessStatus, daysLeft: number | null, notice: AccessNotice | null): Message | null {
  if (notice) {
    switch (notice.kind) {
      case "past_due":
        return {
          text: `Pagamento pendente. Regularize até ${dayMonth(notice.graceUntil)} para evitar o bloqueio.`,
          button: "Regularizar",
          warning: true,
        };
      case "pending_payment":
        return {
          text: "Estamos aguardando a confirmação do seu pagamento. Seu acesso continua liberado.",
          button: "Ver assinatura",
          warning: false,
        };
      case "canceled":
        return {
          text: `Assinatura cancelada. Seu acesso vai até ${dayMonth(notice.until)}.`,
          button: "Assinar de novo",
          warning: true,
        };
      case "readonly":
        return {
          text:
            notice.reason === "trial_ended"
              ? "Seu teste grátis terminou. Você está em modo leitura."
              : notice.reason === "verify"
                ? "Não foi possível verificar sua assinatura agora. Tente novamente em instantes."
                : "Sua assinatura não está ativa. Você está em modo leitura.",
          button: notice.reason === "verify" ? "Ver assinatura" : "Assinar",
          warning: true,
        };
    }
  }
  if (status === "trialing" && daysLeft !== null) {
    return { text: daysLeftText(daysLeft), button: "Assinar", warning: false };
  }
  return null;
}

// Faixa discreta no topo do app: dias do teste, aviso de pagamento, cancelamento ou modo leitura.
// Assinatura ativa e em dia não mostra nada.
export function TrialBanner({ status, daysLeft, notice, showButton }: TrialBannerProps) {
  const message = messageFor(status, daysLeft, notice);
  if (!message) return null;

  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-sm",
        message.warning ? "border-amber-200 bg-amber-50" : "border-violeta/10 bg-nevoa",
      )}
    >
      <p className={cn("min-w-0 flex-1 font-medium", message.warning ? "text-amber-900" : "text-violeta-escuro")}>
        {message.text}
      </p>
      {showButton && (
        <Link href="/assinatura" className={buttonClasses({ size: "sm" })}>
          {message.button}
        </Link>
      )}
    </div>
  );
}
