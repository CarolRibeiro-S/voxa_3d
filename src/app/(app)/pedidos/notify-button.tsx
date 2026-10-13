"use client";

import { MessageCircle } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BoardOrder } from "./orders-board";

// "Avisar cliente": link do WhatsApp, ou botão desabilitado com ajuda quando falta telefone válido.
export function NotifyButton({ order, onRegisterPhone }: { order: BoardOrder; onRegisterPhone?: () => void }) {
  if (!order.canNotify) return null;
  if (order.notifyUrl) {
    return (
      <a
        data-tour="pedidos-avisar"
        href={order.notifyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonClasses({ variant: "secondary", size: "sm" }), "w-full")}
      >
        <MessageCircle size={16} aria-hidden="true" />
        Avisar cliente
      </a>
    );
  }
  return (
    <div data-tour="pedidos-avisar">
      <Button
        variant="secondary"
        size="sm"
        className="w-full"
        disabled
        aria-describedby={`notify-help-${order.id}`}
      >
        <MessageCircle size={16} aria-hidden="true" />
        Avisar cliente
      </Button>
      <p id={`notify-help-${order.id}`} className="mt-1 text-xs text-tinta/60">
        Cadastre o telefone do cliente para avisar
        {onRegisterPhone && (
          <>
            {". "}
            <button
              type="button"
              onClick={onRegisterPhone}
              className="font-semibold text-violeta underline hover:text-violeta-escuro focus-visible:outline-2 focus-visible:outline-violeta"
            >
              Cadastrar telefone
            </button>
          </>
        )}
      </p>
    </div>
  );
}

