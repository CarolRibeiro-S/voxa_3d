"use client";

import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL, formatDate } from "@/lib/format";
import { ORDER_STATUS_LABEL, orderStatusLabel, type DueFlag } from "@/lib/orders";
import { cn } from "@/lib/utils";
import type { OrderKind, OrderStatus, PaymentStatus } from "@/types/database";
import { deleteOrder, moveOrder, setOrderPayment } from "./actions";
import { NewOrderPanel } from "./new-order-panel";
import { NotifyButton } from "./notify-button";
import { OrderNav, PaymentButton } from "./order-nav";
import { DueBadge, OrderStatusBadge } from "./order-ui";
import { AutoTour } from "@/components/tour/tour-provider";
import { OrderPanel } from "./order-panel";

// Tudo que o quadro precisa, já pronto pelo servidor. Sem dados de cálculo.
export interface BoardOrder {
  id: string;
  number: number;
  kind: OrderKind;
  status: OrderStatus;
  customerName: string | null;
  customerPhone: string | null;
  dueDate: string | null;
  dueFlag: DueFlag;
  paymentStatus: PaymentStatus;
  trackingCode: string | null;
  notes: string | null;
  totalBrl: number;
  items: { description: string; quantity: number; unitPrice: number; lineTotal: number }[];
  // Pedido de cliente Pronto ou Enviado: o botão "Avisar cliente" aparece.
  canNotify: boolean;
  // Link do WhatsApp. Nulo quando não há telefone válido.
  notifyUrl: string | null;
}

const COLUMNS: OrderStatus[] = ["placed", "printing", "ready", "shipped", "delivered"];

// Tira acentos e caixa para a busca ignorar as diferenças.
const plain = (value: string) =>
  value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const selectClass =
  "min-h-11 rounded-xl border border-violeta/20 bg-white px-4 text-sm text-tinta shadow-sm outline-none focus:border-violeta focus:ring-2 focus:ring-violeta/20";

function OrderCard({
  order,
  restricted,
  onOpen,
  onMove,
  onPay,
  onDelete,
}: {
  restricted: boolean;
  order: BoardOrder;
  onOpen: () => void;
  onMove: (to: OrderStatus) => void;
  onPay: () => void;
  onDelete: () => void;
}) {
  const title = order.kind === "stock" ? "Estoque" : (order.customerName ?? "Sem nome");

  return (
    <Card data-tour="pedidos-cartao" className="@container p-0">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full rounded-t-xl p-4 pb-2 text-left transition-colors hover:bg-nevoa focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-violeta"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 break-words font-bold">
            <span className="text-tinta/60">#{order.number}</span> {title}
          </p>
          {!restricted && (
            <span className="shrink-0 font-extrabold text-violeta">{formatBRL(order.totalBrl)}</span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {order.kind === "stock" && order.status === "ready" && (
            <OrderStatusBadge kind={order.kind} status={order.status} />
          )}
          <DueBadge flag={order.dueFlag} />
        </div>
        <p className="mt-2 text-xs text-tinta/60">
          {order.items.length} {order.items.length === 1 ? "item" : "itens"}
          {order.dueDate && ` | Prazo ${formatDate(order.dueDate)}`}
        </p>
      </button>

      <div className="space-y-2 px-4 pb-4 pt-1">
        {/* Pedido para estoque não tem pagamento. */}
        {!restricted && order.kind === "client" && (
          <PaymentButton
            className="w-full"
            number={order.number}
            status={order.paymentStatus}
            disabled={order.status === "canceled"}
            onClick={onPay}
          />
        )}
        {!restricted && <NotifyButton order={order} onRegisterPhone={onOpen} />}
        <OrderNav
          orderNumber={order.number}
          kind={order.kind}
          status={order.status}
          onMove={onMove}
          onDelete={onDelete}
          restricted={restricted}
        />
      </div>
    </Card>
  );
}

function Column({
  status,
  orders,
  restricted,
  className,
  onOpen,
  onMove,
  onPay,
  onDelete,
}: {
  status: OrderStatus;
  orders: BoardOrder[];
  restricted: boolean;
  className?: string;
  onOpen: (order: BoardOrder) => void;
  onMove: (order: BoardOrder, to: OrderStatus) => void;
  onPay: (order: BoardOrder) => void;
  onDelete: (order: BoardOrder) => void;
}) {
  return (
    <section aria-labelledby={`col-${status}`} className={className}>
      <h2
        id={`col-${status}`}
        className="mb-3 flex items-center justify-between text-sm font-bold uppercase tracking-wide text-violeta-escuro"
      >
        {ORDER_STATUS_LABEL[status]}
        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-tinta/70">{orders.length}</span>
      </h2>
      {orders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-violeta/20 p-4 text-center text-xs text-tinta/50">
          Nenhum pedido
        </p>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <OrderCard
                restricted={restricted}
                order={order}
                onOpen={() => onOpen(order)}
                onMove={(to) => onMove(order, to)}
                onPay={() => onPay(order)}
                onDelete={() => onDelete(order)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function OrdersBoard({
  orders,
  restricted = false,
  initialOnlyLate = false,
  initialKind = "all",
  initialColumn = "placed",
}: {
  orders: BoardOrder[];
  // Operador: sem valores, pagamento, aviso ao cliente nem ações além de mover entre as 3 primeiras etapas.
  restricted?: boolean;
  // Filtros iniciais vindos da URL (por exemplo, dos atalhos do Painel).
  initialOnlyLate?: boolean;
  initialKind?: "all" | OrderKind;
  initialColumn?: OrderStatus;
}) {
  const [kindFilter, setKindFilter] = useState<"all" | OrderKind>(initialKind);
  const [onlyLate, setOnlyLate] = useState(initialOnlyLate);
  const [search, setSearch] = useState("");
  const [mobileColumn, setMobileColumn] = useState<OrderStatus>(initialColumn);
  const [showCanceled, setShowCanceled] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [moving, setMoving] = useState<{ order: BoardOrder; to: OrderStatus } | null>(null);
  const [paying, setPaying] = useState<BoardOrder | null>(null);
  const [deleting, setDeleting] = useState<BoardOrder | null>(null);

  const query = plain(search.trim().replace(/^#/, ""));
  const visible = orders.filter((o) => {
    if (kindFilter !== "all" && o.kind !== kindFilter) return false;
    if (onlyLate && o.dueFlag !== "overdue") return false;
    if (query === "") return true;
    return plain(o.customerName ?? "").includes(query) || String(o.number).includes(query);
  });
  const byStatus = (status: OrderStatus) => visible.filter((o) => o.status === status);
  const canceled = byStatus("canceled");
  const opened = orders.find((o) => o.id === openId) ?? null;

  const requestMove = (order: BoardOrder, to: OrderStatus) => setMoving({ order, to });

  // Texto da confirmação de cada mudança de coluna.
  const move = moving
    ? (() => {
        const { order, to } = moving;
        const from = order.status;
        const pendingPayment =
          to === "delivered" && order.kind === "client" && order.paymentStatus === "pending";
        const label = orderStatusLabel(order.kind, to);
        if (to === "canceled") {
          return {
            title: "Cancelar este pedido?",
            description: `O pedido #${order.number} ficará bloqueado para edição. Você pode reabrir depois.`,
            confirmLabel: "Cancelar pedido",
            danger: true,
          };
        }
        if (from === "delivered" || from === "canceled") {
          return {
            title: "Reabrir pedido?",
            description: `O pedido #${order.number} volta para ${label} e pode ser editado de novo.`,
            confirmLabel: "Reabrir",
            danger: false,
          };
        }
        return {
          title: `Mover para ${label}?`,
          description: pendingPayment
            ? `O pedido #${order.number} vai de ${orderStatusLabel(order.kind, from)} para ${label}. Este pedido ainda está com pagamento pendente. Deseja entregar mesmo assim?`
            : `O pedido #${order.number} vai de ${orderStatusLabel(order.kind, from)} para ${label}.`,
          confirmLabel: pendingPayment ? "Entregar mesmo assim" : "Mover pedido",
          danger: false,
        };
      })()
    : null;

  const markPaid = paying ? paying.paymentStatus !== "paid" : true;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="orders-kind">Tipo</Label>
          <select
            id="orders-kind"
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as "all" | OrderKind)}
            className={selectClass}
          >
            <option value="all">Todos</option>
            <option value="client">Cliente</option>
            <option value="stock">Estoque</option>
          </select>
        </div>
        <div className="min-w-48 flex-1">
          <Label htmlFor="orders-search">Buscar</Label>
          <Input
            id="orders-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome do cliente ou número"
            autoComplete="off"
          />
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={onlyLate}
            onChange={(e) => setOnlyLate(e.target.checked)}
            className="size-5 accent-violeta"
          />
          Só atrasados
        </label>
        {!restricted && (
          <Button className="ml-auto" onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden="true" />
            Novo pedido
          </Button>
        )}
      </div>

      {/* Celular: uma coluna por vez, escolhida nas abas. */}
      <div role="tablist" aria-label="Colunas" className="flex gap-2 overflow-x-auto pb-1 md:hidden">
        {COLUMNS.map((status) => (
          <button
            key={status}
            type="button"
            role="tab"
            aria-selected={mobileColumn === status}
            onClick={() => setMobileColumn(status)}
            className={cn(
              "min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta",
              mobileColumn === status ? "bg-violeta text-white" : "bg-white text-tinta hover:bg-nevoa",
            )}
          >
            {ORDER_STATUS_LABEL[status]} ({byStatus(status).length})
          </button>
        ))}
      </div>

      <div data-tour="pedidos-colunas" className="md:flex md:items-start md:gap-4 md:overflow-x-auto md:pb-2">
        {COLUMNS.map((status) => (
          <Column
            key={status}
            status={status}
            orders={byStatus(status)}
            restricted={restricted}
            className={cn(
              mobileColumn === status ? "block" : "hidden",
              "md:block md:w-72 md:shrink-0",
            )}
            onOpen={(o) => setOpenId(o.id)}
            onMove={requestMove}
            onPay={setPaying}
            onDelete={setDeleting}
          />
        ))}
      </div>

      <div>
        <button
          type="button"
          aria-expanded={showCanceled}
          onClick={() => setShowCanceled((v) => !v)}
          className="flex min-h-11 items-center gap-2 text-sm font-semibold text-violeta hover:text-violeta-escuro focus-visible:outline-2 focus-visible:outline-violeta"
        >
          <ChevronDown
            size={16}
            className={cn("transition-transform", showCanceled && "rotate-180")}
            aria-hidden="true"
          />
          Cancelados ({canceled.length})
        </button>
        {showCanceled && (
          <div className="mt-3 max-w-md">
            <Column
              status="canceled"
              orders={canceled}
              restricted={restricted}
              onOpen={(o) => setOpenId(o.id)}
              onMove={requestMove}
              onPay={setPaying}
              onDelete={setDeleting}
            />
          </div>
        )}
      </div>

      <NewOrderPanel open={creating} onClose={() => setCreating(false)} />
      <AutoTour id="pedidos" />
      <OrderPanel
        restricted={restricted}
        order={opened}
        onClose={() => setOpenId(null)}
        onMove={requestMove}
        onPay={setPaying}
        onDelete={setDeleting}
      />

      <ConfirmDialog
        open={moving !== null}
        onOpenChange={(open) => {
          if (!open) setMoving(null);
        }}
        title={move?.title ?? ""}
        description={move?.description ?? ""}
        confirmLabel={move?.confirmLabel ?? "Confirmar"}
        variant={move?.danger ? "danger" : "default"}
        onConfirm={async () => {
          if (!moving) return { ok: false, message: "Nada para mover." };
          return moveOrder(moving.order.id, moving.to);
        }}
      />

      <ConfirmDialog
        open={paying !== null}
        onOpenChange={(open) => {
          if (!open) setPaying(null);
        }}
        title={markPaid ? "Marcar como pago?" : "Voltar para pagamento pendente?"}
        description={
          paying
            ? markPaid
              ? `Marcar o pedido #${paying.number} como pago? Valor: ${formatBRL(paying.totalBrl)}`
              : `Voltar o pedido #${paying.number} para pagamento pendente?`
            : ""
        }
        confirmLabel={markPaid ? "Marcar como pago" : "Voltar para pendente"}
        onConfirm={async () => {
          if (!paying) return { ok: false, message: "Nada para alterar." };
          return setOrderPayment(paying.id, markPaid);
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={deleting ? `Excluir pedido #${deleting.number}?` : ""}
        description="O pedido irá para a Lixeira e pode ser restaurado em Histórico."
        confirmLabel="Excluir pedido"
        variant="danger"
        onConfirm={async () => {
          if (!deleting) return { ok: false, message: "Nada para excluir." };
          const result = await deleteOrder(deleting.id);
          if (result.ok && openId === deleting.id) setOpenId(null);
          return result;
        }}
      />
    </div>
  );
}
