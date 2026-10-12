"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConfirmResult = { ok: true } | { ok: false; message: string } | void;

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  // Resumo opcional do que vai mudar.
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  // Para quem controla o carregamento por fora. O diálogo também controla o próprio.
  pending?: boolean;
  error?: string | null;
  // Se retornar { ok: false, message } ou lançar erro, a mensagem aparece no diálogo e ele
  // não fecha. Em sucesso, o diálogo fecha sozinho.
  onConfirm: () => Promise<ConfirmResult>;
}

const GENERIC_ERROR = "Não foi possível concluir. Tente novamente.";

// Diálogo de confirmação único do sistema. Usa o dialog nativo em modal: ele fica na camada
// de cima (inclusive sobre um SidePanel aberto), prende o foco, e o Esc fecha só ele.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel = "Cancelar",
  variant = "default",
  pending: pendingProp = false,
  error: errorProp = null,
  onConfirm,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [localPending, setLocalPending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const pending = pendingProp || localPending;
  const error = errorProp ?? localError;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      openerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      // Foco inicial no botão de cancelar, a escolha mais segura.
      cancelRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Trava a rolagem da página enquanto o diálogo está aberto.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  function handleClose() {
    // Devolve o foco a quem abriu o diálogo.
    const opener = openerRef.current;
    if (opener?.isConnected) opener.focus();
    openerRef.current = null;
    // O erro de uma tentativa anterior não aparece na próxima abertura.
    setLocalError(null);
    onOpenChange(false);
  }

  async function confirm() {
    setLocalError(null);
    setLocalPending(true);
    try {
      const result = await onConfirm();
      if (result && !result.ok) {
        setLocalError(result.message);
      } else {
        onOpenChange(false);
      }
    } catch {
      setLocalError(GENERIC_ERROR);
    } finally {
      setLocalPending(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClose={handleClose}
      // Esc não fecha durante o carregamento.
      onCancel={(e) => {
        if (pending) e.preventDefault();
      }}
      // Clique no fundo fecha, exceto durante o carregamento.
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onOpenChange(false);
      }}
      className="m-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-[28rem] overflow-hidden rounded-xl bg-white p-0 text-tinta shadow-xl backdrop:bg-tinta/50"
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="space-y-2 overflow-y-auto p-5 md:p-6">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <div id={descriptionId} className="text-sm text-tinta/70">
              {description}
            </div>
            {children && <div className="pt-2">{children}</div>}
            {error && (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-violeta/10 p-4 sm:flex-row sm:justify-end md:px-6">
            <Button
              ref={cancelRef}
              variant="secondary"
              className="w-full sm:w-auto"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {cancelLabel}
            </Button>
            <Button
              className={cn(
                "w-full sm:w-auto",
                variant === "danger" &&
                  "bg-red-100 text-red-800 shadow-none hover:bg-red-200 focus-visible:outline-red-600",
              )}
              disabled={pending}
              onClick={() => void confirm()}
            >
              {pending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {confirmLabel}
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
