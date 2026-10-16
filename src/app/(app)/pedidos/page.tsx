import { Card } from "@/components/ui/card";
import { buildNotifyUrl, canNotify, dueFlag, ORDER_STATUSES } from "@/lib/orders";
import { getOrderModels } from "@/lib/models-data";
import type { OrderModelInfo } from "@/lib/models-schema";
import { getOrderItems, getOrders } from "@/lib/orders-data";
import { can } from "@/lib/permissions";
import { hasFeature } from "@/lib/plans";
import { getCurrentTenant, getTenantProfile } from "@/lib/tenant";
import { OrdersBoard, type BoardOrder } from "./orders-board";
import { guardPage } from "@/lib/permissions-server";

export const metadata = { title: "Pedidos | Voxa3D" };

// Data de hoje (AAAA-MM-DD) no fuso de São Paulo.
const todayInSaoPaulo = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold text-tinta">Pedidos</h1>
      <p className="mt-1 text-sm text-tinta/70">
        Acompanhe cada pedido do pedido feito até a entrega.
      </p>
    </div>
  );
}

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ atrasados?: string; tipo?: string; coluna?: string }>;
}) {
  const params = await searchParams;
  const current = await getCurrentTenant();
  if (!current) return null; // O layout já mostra o erro de conta.
  guardPage(current.role, "view_orders");
  const { tenant } = current;

  if (!hasFeature(tenant.plan, "orders")) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Header />
        <Card>
          <p className="text-sm text-tinta/70">Os pedidos não estão disponíveis no seu plano.</p>
        </Card>
      </div>
    );
  }

  // O Operador não vê valores, pagamento, telefone nem observações: o servidor nem seleciona
  // essas colunas para ele.
  const restricted = !can(current.role, "view_money");
  const [orders, profile] = await Promise.all([
    getOrders(restricted),
    restricted ? Promise.resolve(null) : getTenantProfile(tenant.id),
  ]);
  const items = await getOrderItems(
    orders.map((o) => o.id),
    restricted,
  );
  // Modelos dos itens (inclusive os removidos). O servidor só seleciona colunas sem dinheiro.
  const models: Record<string, OrderModelInfo> = await getOrderModels(
    items.flatMap((i) => (i.model_id ? [i.model_id] : [])),
  ).catch((error: unknown) => {
    console.error("Erro ao carregar modelos dos pedidos:", error instanceof Error ? error.message : "desconhecido");
    return {};
  });
  // Assinatura da mensagem do WhatsApp: o nome do negócio, quando existir.
  const businessName = profile?.business_name?.trim() || null;
  const today = todayInSaoPaulo();

  const board: BoardOrder[] = orders.map((o) => ({
    id: o.id,
    number: o.number,
    kind: o.kind,
    status: o.status,
    customerName: o.client_name,
    customerPhone: o.client_phone,
    dueDate: o.due_date,
    dueFlag: dueFlag(o.due_date, today, o.kind, o.status),
    paymentStatus: o.payment_status,
    trackingCode: o.tracking_code,
    notes: o.notes,
    totalBrl: o.total,
    items: items
      .filter((i) => i.order_id === o.id)
      .map((i) => ({
        id: i.id,
        model: i.model_id ? (models[i.model_id] ?? null) : null,
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unit_price,
        lineTotal: i.line_total,
      })),
    canNotify: !restricted && canNotify(o.kind, o.status),
    notifyUrl: buildNotifyUrl({
      kind: o.kind,
      status: o.status,
      number: o.number,
      customerName: o.client_name,
      customerPhone: o.client_phone,
      trackingCode: o.tracking_code,
      businessName,
    }),
  }));

  return (
    <div className="mx-auto max-w-[96rem] space-y-6">
      <Header />
      <OrdersBoard
        orders={board}
        restricted={restricted}
        canSetModel={can(current.role, "manage_orders")}
        canOpenModels={can(current.role, "view_models")}
        initialOnlyLate={params.atrasados === "1"}
        initialKind={params.tipo === "client" || params.tipo === "stock" ? params.tipo : "all"}
        initialColumn={
          ORDER_STATUSES.find((s) => s === params.coluna && s !== "canceled") ?? "placed"
        }
      />
    </div>
  );
}
