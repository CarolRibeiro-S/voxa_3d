"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { TenantPrinter } from "@/types/database";
import { deletePrinter, togglePrinterActive } from "./actions";
import { usePrinterDialog } from "./printers-provider";

type Confirming = "deactivate" | "delete" | null;

export function PrinterActions({ printer }: { printer: TenantPrinter }) {
  const { openEdit } = usePrinterDialog();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [error, setError] = useState<string | null>(null);

  function run(action: (id: string) => ReturnType<typeof deletePrinter>) {
    setError(null);
    startTransition(async () => {
      const result = await action(printer.id);
      if (!result.ok) setError(result.message);
      setConfirming(null);
    });
  }

  const btn = "min-h-11";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        className={btn}
        onClick={() => openEdit(printer)}
      >
        Editar
      </Button>

      {confirming === null && (
        <>
          {printer.is_active ? (
            <Button
              variant="ghost"
              size="sm"
              className={btn}
              onClick={() => setConfirming("deactivate")}
            >
              Desativar
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className={btn}
              disabled={pending}
              onClick={() => run(togglePrinterActive)}
            >
              Reativar
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={`${btn} text-red-700 hover:bg-red-50`}
            onClick={() => setConfirming("delete")}
          >
            Excluir
          </Button>
        </>
      )}

      {confirming === "deactivate" && (
        <>
          <Button
            variant="dark"
            size="sm"
            className={btn}
            disabled={pending}
            onClick={() => run(togglePrinterActive)}
          >
            Confirmar desativar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={btn}
            disabled={pending}
            onClick={() => setConfirming(null)}
          >
            Cancelar
          </Button>
        </>
      )}

      {confirming === "delete" && (
        <>
          <Button
            variant="dark"
            size="sm"
            className={btn}
            disabled={pending}
            onClick={() => run(deletePrinter)}
          >
            Confirmar exclusão
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={btn}
            disabled={pending}
            onClick={() => setConfirming(null)}
          >
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
