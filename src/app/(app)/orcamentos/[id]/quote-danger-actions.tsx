"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { formatQuoteNumber } from "@/lib/quotes-schema";
import { deleteQuote } from "../actions";

interface QuoteDangerActionsProps {
  quoteId: string;
  number: number;
  hasItems: boolean;
}

// Baixar PDF e excluir o orçamento (com confirmação em dois passos).
export function QuoteDangerActions({ quoteId, number, hasItems }: QuoteDangerActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await deleteQuote(quoteId);
      if (result.ok) router.push("/orcamentos");
      else {
        setError(result.message);
        setConfirming(false);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {hasItems ? (
        <a
          href={`/orcamentos/${quoteId}/pdf`}
          download={`orcamento-${formatQuoteNumber(number)}.pdf`}
          className={buttonClasses({})}
        >
          <Download size={16} aria-hidden="true" />
          Baixar PDF
        </a>
      ) : (
        <div>
          <Button disabled aria-describedby="pdf-hint">
            <Download size={16} aria-hidden="true" />
            Baixar PDF
          </Button>
          <p id="pdf-hint" className="mt-1 text-xs text-tinta/60">
            Adicione pelo menos um item
          </p>
        </div>
      )}

      {!confirming ? (
        <Button
          variant="ghost"
          className="text-red-700 hover:bg-red-50"
          onClick={() => setConfirming(true)}
        >
          Excluir orçamento
        </Button>
      ) : (
        <>
          <Button variant="dark" disabled={pending} onClick={remove}>
            Confirmar exclusão
          </Button>
          <Button variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
            Cancelar
          </Button>
        </>
      )}

      {error && (
        <p role="alert" className="w-full text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
