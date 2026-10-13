"use client";

import { useState } from "react";
import { RotateCcw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { restoreItem, undoActivity } from "./actions";

export function UndoButton({ logId }: { logId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button data-tour="historico-desfazer" variant="secondary" size="sm" className="min-h-11" onClick={() => setOpen(true)}>
        <Undo2 size={16} aria-hidden="true" />
        Desfazer
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Desfazer esta alteração?"
        description="O item volta ao estado anterior. Se ele mudou depois dessa alteração, não será possível desfazer."
        confirmLabel="Desfazer alteração"
        onConfirm={() => undoActivity(logId)}
      />
    </>
  );
}

export function RestoreButton({
  entity,
  id,
  name,
}: {
  entity: string;
  id: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button data-tour="historico-restaurar" variant="secondary" size="sm" className="min-h-11" onClick={() => setOpen(true)}>
        <RotateCcw size={16} aria-hidden="true" />
        Restaurar
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Restaurar item?"
        description={`${name} sai da Lixeira e volta a aparecer no sistema.`}
        confirmLabel="Restaurar"
        onConfirm={() => restoreItem(entity, id)}
      />
    </>
  );
}
