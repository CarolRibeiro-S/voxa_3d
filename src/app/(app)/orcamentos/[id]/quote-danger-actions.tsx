"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatQuoteNumber } from "@/lib/quotes-schema";
import { deleteQuote } from "../actions";

interface QuoteDangerActionsProps {
  quoteId: string;
  number: number;
  customerName: string;
  hasItems: boolean;
}

// Baixar PDF e excluir o orçamento (a exclusão pede confirmação).
export function QuoteDangerActions({
  quoteId,
  number,
  customerName,
  hasItems,
}: QuoteDangerActionsProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {hasItems ? (
        <a
          data-tour="orc-pdf"
          href={`/orcamentos/${quoteId}/pdf`}
          download={`orcamento-${formatQuoteNumber(number)}.pdf`}
          className={buttonClasses({})}
        >
          <Download size={16} aria-hidden="true" />
          Baixar PDF
        </a>
      ) : (
        <div>
          <Button disabled aria-describedby="pdf-hint" data-tour="orc-pdf">
            <Download size={16} aria-hidden="true" />
            Baixar PDF
          </Button>
          <p id="pdf-hint" className="mt-1 text-xs text-tinta/60">
            Adicione pelo menos um item
          </p>
        </div>
      )}

      <Button
        variant="ghost"
        className="text-red-700 hover:bg-red-50"
        onClick={() => setConfirming(true)}
      >
        Excluir orçamento
      </Button>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Excluir orçamento nº ${formatQuoteNumber(number)}?`}
        description={`O orçamento de ${customerName} e os itens dele irão para a Lixeira e podem ser restaurados em Histórico.`}
        confirmLabel="Excluir orçamento"
        variant="danger"
        onConfirm={async () => {
          const result = await deleteQuote(quoteId);
          if (result.ok) router.push("/orcamentos");
          return result;
        }}
      />
    </div>
  );
}
