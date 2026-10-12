import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatBRL, formatContact, formatDate } from "@/lib/format";
import { hasFeature } from "@/lib/plans";
import { getQuote, getQuoteItems } from "@/lib/quotes";
import { formatQuoteNumber, UUID_PATTERN } from "@/lib/quotes-schema";
import { getCurrentTenant } from "@/lib/tenant";
import { QuoteStatusBadge } from "../quote-status";
import { CustomerForm } from "./customer-form";
import { QuoteDangerActions } from "./quote-danger-actions";
import { QuoteItems } from "./quote-items";
import { StatusActions } from "./status-actions";

export const metadata = { title: "Orçamento | Voxa3D" };

export default async function OrcamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const current = await getCurrentTenant();
  if (!current) return null; // O layout já mostra o erro de conta.
  if (!hasFeature(current.tenant.plan, "quotes")) notFound();

  // A consulta já filtra pelo tenant da sessão: orçamento de outra conta não aparece.
  const quote = await getQuote(id);
  if (!quote) notFound();
  const items = await getQuoteItems(id);

  const rows = items.map((item) => ({
    id: item.id,
    kind: item.kind,
    description: item.description,
    quantity: item.quantity,
    unit_price_brl: item.unit_price_brl,
    suggested_unit_price_brl: item.suggested_unit_price_brl,
    subtotal_brl: Math.round(item.unit_price_brl * item.quantity * 100) / 100,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/orcamentos"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-violeta hover:text-violeta-escuro"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Orçamentos
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold text-tinta">
            Orçamento nº {formatQuoteNumber(quote.number)}
          </h1>
          <QuoteStatusBadge status={quote.status} />
        </div>
        <p className="mt-1 text-sm text-tinta/70">
          Criado em {formatDate(quote.created_at)}
          {quote.approved_at && `. Aprovado em ${formatDate(quote.approved_at)}`}
        </p>
        {quote.customer_contact && (
          <p className="text-sm text-tinta/70">
            {quote.customer_name}: {formatContact(quote.customer_contact)}
          </p>
        )}
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-violeta-escuro">
          Cliente
        </h2>
        <CustomerForm
          quoteId={quote.id}
          initial={{
            customer_name: quote.customer_name,
            customer_contact: quote.customer_contact ?? "",
            valid_until: quote.valid_until ?? "",
            notes: quote.notes ?? "",
          }}
        />
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-violeta-escuro">
          Status
        </h2>
        <StatusActions quoteId={quote.id} status={quote.status} />
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-violeta-escuro">
          Itens
        </h2>
        <QuoteItems quoteId={quote.id} items={rows} canAdd={quote.status === "draft"} />
      </Card>

      <Card variant="dark" className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold text-white/80">Total do orçamento</span>
        <span className="text-3xl font-extrabold" aria-live="polite">
          {formatBRL(quote.total_brl)}
        </span>
      </Card>

      <QuoteDangerActions quoteId={quote.id} number={quote.number} hasItems={items.length > 0} />
    </div>
  );
}
