"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoreMenu, type MenuItem } from "@/components/ui/menu";
import { getMoveGroups, moveLabel, orderStatusLabel } from "@/lib/orders";
import { OPERATOR_MOVE_STATUSES } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { OrderKind, OrderStatus, PaymentStatus } from "@/types/database";

// ---- Pagamento: o selo é um botão que abre a confirmação ----

export function PaymentButton({
  number,
  status,
  disabled = false,
  onClick,
  className,
}: {
  number: number;
  status: PaymentStatus;
  // Pedido cancelado: somente leitura.
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) {
  const paid = status === "paid";
  const Icon = paid ? CheckCircle2 : Clock;
  const text = paid ? "Pago" : "Pendente";
  const base =
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-center text-sm font-semibold leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta md:min-h-10 [&_svg]:shrink-0";
  const tone = paid
    ? "border-green-300 bg-green-100 text-green-800 hover:bg-green-200"
    : "border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200";
  const description = paid
    ? `Pagamento recebido do pedido ${number}, tocar para voltar para pendente`
    : `Pagamento pendente do pedido ${number}, tocar para marcar como pago`;

  if (disabled) {
    return (
      <span data-tour="pedidos-pagamento" className={cn(base, tone, "opacity-70", className)}>
        <Icon size={16} aria-hidden="true" />
        Pagamento: {text}
      </span>
    );
  }

  return (
    <button
      type="button"
      data-tour="pedidos-pagamento"
      onClick={onClick}
      aria-label={description}
      title={description}
      className={cn(base, tone, className)}
    >
      <Icon size={16} aria-hidden="true" />
      Pagamento: {text}
    </button>
  );
}

// ---- Voltar à esquerda, Avançar à direita, demais ações no menu "Mais" ----

export function OrderNav({
  orderNumber,
  kind,
  status,
  onMove,
  onDelete,
  menuPlacement = "up",
  restricted = false,
}: {
  orderNumber: number;
  kind: OrderKind;
  status: OrderStatus;
  onMove: (to: OrderStatus) => void;
  onDelete: () => void;
  menuPlacement?: "up" | "down";
  // Operador: só Voltar e Avançar entre Pedido feito, Imprimindo e Pronto, sem menu "Mais".
  restricted?: boolean;
}) {
  const full = getMoveGroups(kind, status);
  const allowed = (to: OrderStatus | null) =>
    to !== null && OPERATOR_MOVE_STATUSES.some((s) => s === to) && OPERATOR_MOVE_STATUSES.some((s) => s === status)
      ? to
      : null;
  const groups = restricted
    ? { ...full, previous: allowed(full.previous), next: allowed(full.next), others: [], reopen: null, cancel: false }
    : full;

  // Ordem do menu: outros destinos, reabrir, e no fim (em vermelho, após o divisor) excluir e cancelar.
  const items: MenuItem[] = restricted
    ? []
    : [
    ...groups.others.map((to) => ({
      key: `to-${to}`,
      label: `Mover para ${orderStatusLabel(kind, to)}`,
      onSelect: () => onMove(to),
    })),
    ...(groups.reopen
      ? [
          {
            key: "reopen",
            label: moveLabel(kind, status, groups.reopen),
            onSelect: () => onMove(groups.reopen as OrderStatus),
          },
        ]
      : []),
    {
      key: "delete",
      label: "Excluir pedido",
      danger: true,
      dividerBefore: true,
      onSelect: onDelete,
    },
    ...(groups.cancel
      ? [
          {
            key: "cancel",
            label: "Cancelar pedido",
            danger: true,
            onSelect: () => onMove("canceled"),
          },
        ]
      : []),
  ];

  const previousLabel = groups.previous ? orderStatusLabel(kind, groups.previous) : "";
  const nextLabel = groups.next ? orderStatusLabel(kind, groups.next) : "";

  // O contêiner pai usa @container. Em espaço estreito o Voltar é só a seta e o Avançar mostra só
  // o nome da etapa; o texto completo vai para aria-label e title. A partir de @sm aparece o texto.
  return (
    <div data-tour="pedidos-navegacao" className="flex items-center gap-2">
      {groups.previous && (
        <Button
          variant="secondary"
          className="min-w-11 shrink-0 px-0 text-tinta/80 @sm:px-3"
          aria-label={`Voltar para ${previousLabel}`}
          title={`Voltar para ${previousLabel}`}
          onClick={() => onMove(groups.previous as OrderStatus)}
        >
          <ArrowLeft size={18} aria-hidden="true" />
          <span className="hidden @sm:inline">Voltar</span>
        </Button>
      )}
      {groups.next && (
        <Button
          className="min-w-0 flex-1 px-3"
          aria-label={`Avançar para ${nextLabel}`}
          title={`Avançar para ${nextLabel}`}
          onClick={() => onMove(groups.next as OrderStatus)}
        >
          <span className="min-w-0">
            <span className="@sm:hidden">{nextLabel}</span>
            <span className="hidden @sm:inline">Avançar: {nextLabel}</span>
          </span>
          <ArrowRight size={18} aria-hidden="true" />
        </Button>
      )}
      <div className={cn(!groups.next && "ml-auto")}>
        <MoreMenu
          label={`Mais ações do pedido ${orderNumber}`}
          items={items}
          placement={menuPlacement}
        />
      </div>
    </div>
  );
}
