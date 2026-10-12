"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { QUOTE_TRANSITIONS, transitionLabel } from "@/lib/quotes-schema";
import type { QuoteStatus } from "@/types/database";
import { setQuoteStatus } from "../actions";

function dialogText(from: QuoteStatus, to: QuoteStatus): { title: string; description: string } {
  if (to === "sent" && from === "draft") {
    return {
      title: "Marcar como enviado?",
      description: "O orçamento passa para Enviado. Novos itens só podem ser adicionados em rascunho.",
    };
  }
  if (to === "sent") {
    return {
      title: "Reabrir orçamento?",
      description: "Ele volta para Enviado e pode ser editado de novo.",
    };
  }
  if (to === "approved") {
    return {
      title: "Marcar como aprovado?",
      description: "O orçamento ficará bloqueado para edição. Você pode reabrir depois.",
    };
  }
  if (to === "declined") {
    return {
      title: "Marcar como recusado?",
      description: "O orçamento ficará bloqueado para edição. Você pode reabrir depois.",
    };
  }
  return {
    title: "Voltar para rascunho?",
    description: "O orçamento volta a ser um rascunho e aceita novos itens.",
  };
}

// Mostra só as ações válidas para o status atual. Cada uma pede confirmação.
export function StatusActions({ quoteId, status }: { quoteId: string; status: QuoteStatus }) {
  const [target, setTarget] = useState<QuoteStatus | null>(null);
  const text = target ? dialogText(status, target) : null;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {QUOTE_TRANSITIONS[status].map((to) => (
          <Button
            key={to}
            variant={to === "draft" ? "ghost" : "secondary"}
            size="sm"
            className="min-h-11"
            onClick={() => setTarget(to)}
          >
            {transitionLabel(status, to)}
          </Button>
        ))}
      </div>

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        title={text?.title ?? ""}
        description={text?.description ?? ""}
        confirmLabel={target ? transitionLabel(status, target) : "Confirmar"}
        onConfirm={async () => {
          if (target === null) return { ok: false, message: "Nada para alterar." };
          return setQuoteStatus(quoteId, target);
        }}
      />
    </div>
  );
}
