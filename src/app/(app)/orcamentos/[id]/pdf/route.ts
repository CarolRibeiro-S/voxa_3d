import type { NextRequest } from "next/server";
import { hasFeature } from "@/lib/plans";
import { getQuote, getQuoteItems } from "@/lib/quotes";
import { formatQuoteNumber, UUID_PATTERN } from "@/lib/quotes-schema";
import { renderQuotePdf } from "@/lib/quote-pdf";
import { getCurrentTenant, getCurrentUser, getTenantProfile } from "@/lib/tenant";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(_req: NextRequest, ctx: RouteContext<"/orcamentos/[id]/pdf">) {
  const { id } = await ctx.params;

  const user = await getCurrentUser();
  if (!user) return new Response("Sessão expirada", { status: 401, headers: NO_STORE });

  const current = await getCurrentTenant();
  if (!current || !hasFeature(current.tenant.plan, "quotes") || !UUID_PATTERN.test(id)) {
    return new Response("Não encontrado", { status: 404, headers: NO_STORE });
  }

  try {
    // Só do próprio tenant (RLS). As consultas não trazem os dados de cálculo.
    const quote = await getQuote(id);
    if (!quote) return new Response("Não encontrado", { status: 404, headers: NO_STORE });
    const [items, profile] = await Promise.all([
      getQuoteItems(id),
      getTenantProfile(current.tenant.id),
    ]);
    if (items.length === 0) {
      return new Response("Adicione pelo menos um item", { status: 400, headers: NO_STORE });
    }

    const pdf = await renderQuotePdf({
      businessName: profile?.business_name?.trim() || current.tenant.name,
      whatsapp: profile?.whatsapp ?? null,
      instagram: profile?.instagram ?? null,
      number: quote.number,
      issuedAt: quote.created_at,
      customerName: quote.customer_name,
      customerContact: quote.customer_contact,
      validUntil: quote.valid_until,
      notes: quote.notes,
      totalBrl: quote.total_brl,
      items: items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPriceBrl: item.unit_price_brl,
        subtotalBrl: Math.round(item.unit_price_brl * item.quantity * 100) / 100,
      })),
    });

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="orcamento-${formatQuoteNumber(quote.number)}.pdf"`,
        ...NO_STORE,
      },
    });
  } catch (error) {
    // Registra só a mensagem do erro, sem dados do usuário.
    console.error("Erro ao gerar o PDF do orçamento:", error instanceof Error ? error.message : "desconhecido");
    return new Response("Não foi possível gerar o PDF", { status: 500, headers: NO_STORE });
  }
}
