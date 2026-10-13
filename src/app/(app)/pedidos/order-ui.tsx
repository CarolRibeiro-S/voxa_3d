import { Badge } from "@/components/ui/badge";
import { orderStatusLabel, PAYMENT_LABEL, type DueFlag } from "@/lib/orders";
import { cn } from "@/lib/utils";
import type { OrderKind, OrderStatus, PaymentStatus } from "@/types/database";

// Cores de status com contraste AA sobre o fundo claro.
const STATUS_CLASS: Record<OrderStatus, string> = {
  placed: "bg-tinta/10 text-tinta/80",
  printing: "bg-violeta/10 text-violeta-escuro",
  ready: "bg-green-100 text-green-800",
  shipped: "bg-blue-100 text-blue-800",
  delivered: "bg-slate-700 text-white",
  canceled: "bg-red-50 text-red-700",
};

export function OrderStatusBadge({ kind, status }: { kind: OrderKind; status: OrderStatus }) {
  return <Badge className={STATUS_CLASS[status]}>{orderStatusLabel(kind, status)}</Badge>;
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge variant={status === "paid" ? "success" : "warning"}>Pagamento: {PAYMENT_LABEL[status]}</Badge>
  );
}

export function DueBadge({ flag }: { flag: DueFlag }) {
  if (!flag) return null;
  return (
    <Badge className={cn(flag === "overdue" ? "bg-red-600 text-white" : "bg-amber-100 text-amber-900")}>
      {flag === "overdue" ? "Atrasado" : "Vence em breve"}
    </Badge>
  );
}
