"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

// Painel lateral no mesmo padrão de Máquinas e Materiais. O conteúdo só é montado
// enquanto o painel está aberto, então cada abertura começa com formulário limpo.
export function SidePanel({ open, onClose, title, children }: SidePanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // O dialog nativo cuida de Esc, foco preso e retorno do foco ao botão.
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-white p-0 text-tinta shadow-xl backdrop:bg-tinta/50 md:left-auto md:right-0 md:w-[30rem]"
    >
      {open && (
        <div className="flex h-dvh flex-col">
          <div className="flex items-center justify-between border-b border-violeta/10 p-4 md:px-6">
            <h2 id={titleId} className="text-lg font-extrabold">
              {title}
            </h2>
            <IconButton label="Fechar" onClick={onClose}>
              <X size={20} aria-hidden="true" />
            </IconButton>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function PanelBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex-1 space-y-4 overflow-y-auto p-4 md:p-6", className)}>{children}</div>
  );
}

export function PanelFooter({ children }: { children: ReactNode }) {
  return (
    // No celular os botões ficam empilhados em largura total, com a ação principal (a última) em
    // cima. A partir de sm ficam lado a lado, dividindo o espaço.
    <div className="flex flex-col-reverse gap-2 border-t border-violeta/10 p-4 sm:flex-row sm:gap-3 md:px-6 [&>*]:w-full sm:[&>*]:min-w-0 sm:[&>*]:flex-1">
      {children}
    </div>
  );
}
