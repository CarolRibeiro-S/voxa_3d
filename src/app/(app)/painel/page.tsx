import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDashboard } from "@/lib/dashboard";
import { formatBRL, formatDate } from "@/lib/format";
import { formatQuoteNumber } from "@/lib/quotes-schema";
import { getCostSettings, getCurrentTenant } from "@/lib/tenant";
import { cn } from "@/lib/utils";
import { QuoteStatusBadge } from "../orcamentos/quote-status";
import { OrderStatusBadge, PaymentBadge } from "../pedidos/order-ui";
import { AutoTour } from "@/components/tour/tour-provider";
import { HourlyRateCard } from "./hourly-rate-card";
import { guardPage } from "@/lib/permissions-server";

export const metadata = { title: "Painel | Voxa3D" };

function SummaryCard({
  href,
  label,
  value,
  hint,
  alert = false,
  tour,
}: {
  tour?: string;
  href: string;
  label: string;
  value: string;
  hint?: ReactNode;
  // Acento vermelho suave, só quando há algo a resolver.
  alert?: boolean;
}) {
  return (
    <Link
      href={href}
      data-tour={tour}
      className="block min-w-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta"
    >
      <Card
        className={cn(
          "h-full p-4 transition-colors hover:bg-nevoa",
          alert && "border-red-200 bg-red-50 hover:bg-red-50",
        )}
      >
        <p className="text-xs font-semibold leading-tight text-tinta/70">{label}</p>
        <p
          className={cn(
            "mt-1 text-xl font-extrabold leading-tight [overflow-wrap:anywhere] md:text-2xl",
            alert ? "text-red-700" : "text-violeta-escuro",
          )}
        >
          {value}
        </p>
        {hint && <p className="mt-1 text-xs leading-tight text-tinta/60">{hint}</p>}
      </Card>
    </Link>
  );
}

function ListHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-bold uppercase tracking-wide text-violeta-escuro">{title}</h2>
      <Link
        href={href}
        className="inline-flex min-h-11 items-center text-sm font-semibold text-violeta hover:text-violeta-escuro focus-visible:outline-2 focus-visible:outline-violeta"
      >
        Ver todos
      </Link>
    </div>
  );
}

const STAGES = [
  { key: "placed", label: "Pedido feito" },
  { key: "printing", label: "Imprimindo" },
  { key: "ready", label: "Pronto" },
  { key: "shipped", label: "Enviado" },
] as const;

export default async function PainelPage() {
  const current = await getCurrentTenant();
  if (!current) return null; // O layout já mostra o erro de conta.
  guardPage(current.role, "view_dashboard");

  const [result, settings] = await Promise.all([getDashboard(), getCostSettings(current.tenant.id)]);
  if (!result) return null;

  // Se o resumo não carregou, mostra o erro (nunca zeros no lugar) e mantém o ajudante da hora.
  if (!result.ok) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <h1 className="text-2xl font-extrabold text-tinta">Painel</h1>
        <Card className="border-red-200 bg-red-50">
          <p role="alert" className="text-sm font-medium text-red-700">
            Não foi possível carregar o resumo agora.
          </p>
          <p className="mt-1 text-sm text-red-700/80">Atualize a página em alguns instantes.</p>
        </Card>
        <HourlyRateCard settings={settings} />
      </div>
    );
  }
  const data = result.data;

  const biggestStage = Math.max(1, ...STAGES.map((s) => data.stages[s.key]));
  const stockTotal = data.stock.inProgress + data.stock.ready;
  const biggestForStock = Math.max(biggestStage, stockTotal, 1);
  const { revenue } = data;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-tinta">Painel</h1>
        <p className="mt-1 text-sm text-tinta/70">Um resumo do que está acontecendo no seu negócio.</p>
      </div>

      {data.isEmpty && (
        <Card className="flex flex-wrap items-center justify-between gap-4 bg-nevoa">
          <p className="min-w-0 flex-1 text-sm font-medium">
            Seu painel ganha vida conforme você usa o sistema. Comece cadastrando sua primeira
            máquina.
          </p>
          <Link href="/maquinas" className={buttonClasses({})}>
            Cadastrar máquina
          </Link>
        </Card>
      )}

      <section aria-label="Resumo" data-tour="painel-resumo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          href="/pedidos?atrasados=1"
          tour="painel-atrasados"
          label="Pedidos atrasados"
          value={String(data.late)}
          hint={data.late > 0 ? "Ver só os atrasados" : "Nenhum pedido atrasado"}
          alert={data.late > 0}
        />
        <SummaryCard
          href="/pedidos"
          label="Entregas da semana"
          value={String(data.weekDeliveries)}
          hint="Prazos de hoje até 7 dias"
        />
        <SummaryCard
          href="/pedidos"
          label="A receber"
          value={formatBRL(data.receivable.total)}
          hint={`${data.receivable.count} ${data.receivable.count === 1 ? "pedido" : "pedidos"} com pagamento pendente`}
        />
        <SummaryCard
          href="/pedidos"
          label="Faturamento do mês"
          value={formatBRL(revenue.current)}
          hint={
            revenue.changePct === null ? (
              "Pedidos pagos neste mês"
            ) : (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-semibold",
                  revenue.changePct >= 0 ? "text-green-700" : "text-red-700",
                )}
              >
                {revenue.changePct >= 0 ? (
                  <ArrowUpRight size={14} aria-hidden="true" />
                ) : (
                  <ArrowDownRight size={14} aria-hidden="true" />
                )}
                {Math.abs(revenue.changePct)}% sobre o mês anterior
              </span>
            )
          }
        />
        <SummaryCard
          href="/orcamentos?status=sent"
          label="Orçamentos aguardando resposta"
          value={String(data.quotesWaiting.count)}
          hint={formatBRL(data.quotesWaiting.total)}
        />
        <SummaryCard
          href="/orcamentos?status=approved"
          label="Aprovados no mês"
          value={String(data.approvedThisMonth)}
          hint="Orçamentos aprovados neste mês"
        />
      </section>

      <Card data-tour="painel-etapas">
        <h2 className="text-sm font-bold uppercase tracking-wide text-violeta-escuro">
          Pedidos por etapa
        </h2>
        <ul className="mt-4 space-y-2">
          {STAGES.map((stage) => (
            <li key={stage.key}>
              <Link
                href={`/pedidos?coluna=${stage.key}`}
                className="block rounded-xl p-2 hover:bg-nevoa focus-visible:outline-2 focus-visible:outline-violeta"
              >
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 font-medium">{stage.label}</span>
                  <span className="font-bold">{data.stages[stage.key]}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-nevoa" aria-hidden="true">
                  <div
                    className="h-2 rounded-full bg-violeta"
                    style={{ width: `${(data.stages[stage.key] / biggestStage) * 100}%` }}
                  />
                </div>
              </Link>
            </li>
          ))}
          <li className="border-t border-violeta/10 pt-2">
            <Link
              href="/pedidos?tipo=stock"
              className="block rounded-xl p-2 hover:bg-nevoa focus-visible:outline-2 focus-visible:outline-violeta"
            >
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 font-medium">Produção para estoque</span>
                <span className="font-bold">{stockTotal}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-nevoa" aria-hidden="true">
                <div
                  className="h-2 rounded-full bg-violeta-escuro"
                  style={{ width: `${(stockTotal / biggestForStock) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-tinta/60">
                {data.stock.inProgress} em produção e {data.stock.ready} prontos para estoque
              </p>
            </Link>
          </li>
        </ul>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <ListHeader title="Próximas entregas" href="/pedidos" />
          {data.upcoming.length === 0 ? (
            <p className="text-sm text-tinta/60">Nenhuma entrega com prazo definido.</p>
          ) : (
            <ul className="divide-y divide-violeta/10">
              {data.upcoming.map((o) => (
                <li key={o.id} className="py-3">
                  <Link
                    href="/pedidos"
                    className="block rounded-xl focus-visible:outline-2 focus-visible:outline-violeta"
                  >
                    <p className="font-semibold [overflow-wrap:anywhere]">
                      <span className="text-tinta/60">#{o.number}</span> {o.clientName}
                    </p>
                    <p
                      className={cn(
                        "text-xs",
                        o.overdue ? "font-semibold text-red-700" : "text-tinta/60",
                      )}
                    >
                      {o.overdue ? "Atrasado desde " : "Prazo "}
                      {formatDate(o.dueDate)}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <OrderStatusBadge kind="client" status={o.status} />
                      <PaymentBadge status={o.paymentStatus} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <ListHeader title="Orçamentos recentes" href="/orcamentos" />
          {data.recentQuotes.length === 0 ? (
            <p className="text-sm text-tinta/60">Nenhum orçamento ainda.</p>
          ) : (
            <ul className="divide-y divide-violeta/10">
              {data.recentQuotes.map((q) => (
                <li key={q.id} className="py-3">
                  <Link
                    href={`/orcamentos/${q.id}`}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-xl focus-visible:outline-2 focus-visible:outline-violeta"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold [overflow-wrap:anywhere]">
                        <span className="text-tinta/60">{formatQuoteNumber(q.number)}</span>{" "}
                        {q.customerName}
                      </span>
                      <span className="text-sm font-semibold text-violeta">{formatBRL(q.total)}</span>
                    </span>
                    <QuoteStatusBadge status={q.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <HourlyRateCard settings={settings} />
      <AutoTour id="painel" />
    </div>
  );
}
