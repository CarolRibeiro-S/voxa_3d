"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptInvite } from "./actions";

export function AcceptButton({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            // Em sucesso o servidor redireciona; só volta aqui quando há mensagem.
            const result = await acceptInvite(token);
            if (result) setError(result.message);
          })
        }
      >
        {pending && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
        Aceitar convite
      </Button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
