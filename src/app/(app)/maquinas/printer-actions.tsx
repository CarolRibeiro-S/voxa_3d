"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { TenantPrinter } from "@/types/database";
import { deletePrinter, togglePrinterActive } from "./actions";
import { usePrinterDialog } from "./printers-provider";

type Pending = "deactivate" | "reactivate" | "delete" | null;

export function PrinterActions({ printer }: { printer: TenantPrinter }) {
  const { openEdit } = usePrinterDialog();
  const [action, setAction] = useState<Pending>(null);

  const name = printer.nickname || printer.model;
  const btn = "min-h-11";

  const texts = {
    deactivate: {
      title: "Desativar máquina?",
      description: `A máquina ${name} deixa de aparecer nas calculadoras. Orçamentos e cálculos já salvos não mudam.`,
      confirmLabel: "Desativar máquina",
    },
    reactivate: {
      title: "Reativar máquina?",
      description: `A máquina ${name} volta a aparecer nas calculadoras.`,
      confirmLabel: "Reativar máquina",
    },
    delete: {
      title: "Excluir máquina?",
      description: `A máquina ${name} será excluída. Orçamentos e cálculos já salvos não mudam.`,
      confirmLabel: "Excluir máquina",
    },
  } as const;
  const text = action ? texts[action] : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" className={btn} onClick={() => openEdit(printer)}>
        Editar
      </Button>

      {printer.is_active ? (
        <Button variant="ghost" size="sm" className={btn} onClick={() => setAction("deactivate")}>
          Desativar
        </Button>
      ) : (
        <Button variant="ghost" size="sm" className={btn} onClick={() => setAction("reactivate")}>
          Reativar
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        className={`${btn} text-red-700 hover:bg-red-50`}
        onClick={() => setAction("delete")}
      >
        Excluir
      </Button>

      <ConfirmDialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open) setAction(null);
        }}
        title={text?.title ?? ""}
        description={text?.description ?? ""}
        confirmLabel={text?.confirmLabel ?? "Confirmar"}
        variant={action === "reactivate" ? "default" : "danger"}
        onConfirm={() =>
          action === "delete" ? deletePrinter(printer.id) : togglePrinterActive(printer.id)
        }
      />
    </div>
  );
}
