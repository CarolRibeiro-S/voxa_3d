import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL, formatDate } from "@/lib/format";
import { hasFeature } from "@/lib/plans";
import { getQuotes } from "@/lib/quotes";
import {
  formatQuoteNumber,
  QUOTE_STATUS_LABEL,
  QUOTE_STATUSES,
} from "@/lib/quotes-schema";
import { getCurrentTenant } from "@/lib/tenant";
import type { Quote, QuoteStatus } from "@/types/database";
import { NewQuoteButton } from "./new-quote-button";
import { QuoteStatusBadge } from "./quote-status";

export const metadata = { title: "Orçamentos | Voxa3D" };

function Header({ action }: { action?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold text-tinta">Orçamentos</h1>
        <p className="mt-1 text-sm text-tinta/70">Propostas para os seus clientes.</p>
      </div>
      {action && <NewQuoteButton />}
    </div>
  );
}

function QuoteCard({ quote }: { quote: Quote }) {
  return (
    <Link
      href={`/orcamentos/${quote.id}`}
      className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta"
    >
      <Card className="p-4 transition-colors hover:bg-nevoa">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-tinta/60">Nº {formatQuoteNumber(quote.number)}</p>
            <p className="truncate font-bold">{quote.customer_name}</p>
          </div>
          <QuoteStatusBadge status={quote.status} />
        </div>
        <div className="mt-3 flex items-end justify-between text-sm">
          <span className="text-tinta/60">{formatDate(quote.created_at)}</span>
          <span className="font-extrabold text-violeta">{formatBRL(quote.total_brl)}</span>
        </div>
      </Card>
    </Link>
  );
}

export default async function OrcamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const current = await getCurrentTenant();
  if (!current) return null; // O layout já mostra o erro de conta.

  if (!hasFeature(current.tenant.plan, "quotes")) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Header />
        <Card>
          <p className="text-sm text-tinta/70">Os orçamentos não estão disponíveis no seu plano.</p>
        </Card>
      </div>
    );
  }

  const params = await searchParams;
  const search = (params.q ?? "").trim().slice(0, 120);
  const status = QUOTE_STATUSES.find((s) => s === params.status) ?? null;
  const filtering = search !== "" || status !== null;

  const quotes = await getQuotes({ search, status: status as QuoteStatus | null });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Header action />

      <form method="get" className="flex flex-wrap items-end gap-3" role="search">
        <div className="min-w-48 flex-1">
          <Label htmlFor="q">Buscar cliente</Label>
          <Input id="q" name="q" defaultValue={search} placeholder="Nome do cliente" maxLength={120} />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={status ?? ""}
            className="min-h-11 rounded-xl border border-violeta/20 bg-white px-4 text-sm text-tinta shadow-sm outline-none focus:border-violeta focus:ring-2 focus:ring-violeta/20"
          >
            <option value="">Todos</option>
            {QUOTE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {QUOTE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
        {filtering && (
          <Link href="/orcamentos" className={buttonClasses({ variant: "ghost" })}>
            Limpar
          </Link>
        )}
      </form>

      {quotes.length === 0 ? (
        <Card className="text-center">
          <p className="font-semibold">
            {filtering ? "Nenhum orçamento encontrado" : "Nenhum orçamento ainda"}
          </p>
          <p className="mt-1 text-sm text-tinta/70">
            {filtering
              ? "Tente outro nome ou outro status."
              : "Crie um orçamento aqui ou salve o resultado das calculadoras FDM e de Resina direto em um orçamento."}
          </p>
          {!filtering && (
            <div className="mt-4 flex justify-center">
              <NewQuoteButton />
            </div>
          )}
        </Card>
      ) : (
        <>
          <ul className="grid gap-3 md:hidden">
            {quotes.map((q) => (
              <li key={q.id}>
                <QuoteCard quote={q} />
              </li>
            ))}
          </ul>

          <Card className="hidden overflow-hidden p-0 md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Lista de orçamentos</caption>
              <thead className="bg-nevoa text-left text-xs uppercase tracking-wide text-tinta/60">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Nº</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Cliente</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Data</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Total</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-violeta/10">
                {quotes.map((q) => (
                  <tr key={q.id} className="hover:bg-nevoa/60">
                    <td className="px-4 py-3 font-semibold">{formatQuoteNumber(q.number)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/orcamentos/${q.id}`}
                        className="font-semibold text-violeta hover:text-violeta-escuro focus-visible:outline-2 focus-visible:outline-violeta"
                      >
                        {q.customer_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-tinta/70">{formatDate(q.created_at)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatBRL(q.total_brl)}</td>
                    <td className="px-4 py-3">
                      <QuoteStatusBadge status={q.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
