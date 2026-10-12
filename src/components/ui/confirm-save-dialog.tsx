"use client";

import { ChangesSummary, type ChangeItem } from "@/components/ui/changes-summary";
import { ConfirmDialog, type ConfirmResult } from "@/components/ui/confirm-dialog";

interface ConfirmSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changes: ChangeItem[];
  onConfirm: () => Promise<ConfirmResult>;
}

// Confirmação padrão ao salvar a edição de um registro, com o resumo do que muda.
export function ConfirmSaveDialog({ open, onOpenChange, changes, onConfirm }: ConfirmSaveDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Salvar alterações?"
      description="Confira o que vai mudar."
      confirmLabel="Salvar alterações"
      cancelLabel="Voltar e revisar"
      onConfirm={onConfirm}
    >
      <ChangesSummary changes={changes} />
    </ConfirmDialog>
  );
}
