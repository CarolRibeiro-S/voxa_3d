"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { QuoteStatus } from "@/types/database";
import { setQuoteStatus } from "../actions";

const ACTIONS: { status: QuoteStatus; label: string }[] = [
  { status: "sent", label: "Marcar como enviado" },
  { status: "approved", label: "Marcar como aprovado" },
  { status: "declined", label: "Marcar como recusado" },
  { status: "draft", label: "Voltar para rascunho" },
];

export function StatusActions({ quoteId, status }: { quoteId: string; status: QuoteStatus }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(next: QuoteStatus) {
    setError(null);
    startTransition(async () => {
      const result = await setQuoteStatus(quoteId, next);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.filter((a) => a.status !== status).map((a) => (
          <Button
            key={a.status}
            variant={a.status === "draft" ? "ghost" : "secondary"}
            size="sm"
            className="min-h-11"
            disabled={pending}
            onClick={() => change(a.status)}
          >
            {a.label}
          </Button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
