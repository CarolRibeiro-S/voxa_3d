"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { Check, Clock, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getPriceGrid, validateCoupon } from "@/lib/billing/actions";
import { PLAN_FEATURE_LISTS, PLAN_TAGLINES } from "@/lib/billing/features";
import type { PriceGrid, QuoteView } from "@/lib/billing/grid-types";
import type { LaunchLevel } from "@/lib/billing/launch-types";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

// Só exibe o que o servidor calculou. Nenhuma conta de preço acontece aqui.

const cents = (value: number) => formatBRL(value / 100);

interface AppliedCoupon {
  code: string;
  kind: "launch" | "referral";
  extraPct: number;
}

interface PricingBoardProps {
  mode: "public" | "account";
  initialGrid: PriceGrid;
  // Só o nível das vagas chega aqui, nunca a quantidade.
  launchLevel: LaunchLevel;
  // Destaque de urgência (renderizado no servidor), posicionado acima do cupom.
  banner: ReactNode;
  signedIn: boolean;
  currentPlan?: string;
}

function SavingsBadge({ quote }: { quote: QuoteView }) {
  if (quote.savedCents <= 0) return null;
  return (
    <Badge variant="success">
      Economia de {cents(quote.savedCents)} ({quote.pctApplied.toLocaleString("pt-BR")}%)
    </Badge>
  );
}

export function PricingBoard({
  mode,
  initialGrid,
  launchLevel,
  banner,
  signedIn,
  currentPlan,
}: PricingBoardProps) {
  const [grid, setGrid] = useState(initialGrid);
  const [periodCode, setPeriodCode] = useState(initialGrid.periods[0]?.code ?? "");
  const [planCode, setPlanCode] = useState(currentPlan ?? initialGrid.plans[0]?.code ?? "");
  const [coupons, setCoupons] = useState<AppliedCoupon[]>([]);
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const soldOut = launchLevel === "soldout";
  // Na página pública o campo de cupom some quando as vagas de lançamento acabam.
  const showCouponField = mode === "account" || !soldOut;

  function refreshGrid(next: AppliedCoupon[]) {
    return getPriceGrid(next.map((c) => c.code)).then((result) => {
      if (result.ok) {
        setGrid(result.data);
        setCoupons(next);
        return null;
      }
      return result.error;
    });
  }

  function applyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    setCouponError(null);
    startTransition(async () => {
      const checked = await validateCoupon(code);
      if (!checked.ok) {
        setCouponError(checked.error);
        return;
      }
      if (coupons.some((c) => c.kind === checked.data.kind)) {
        setCouponError(
          checked.data.kind === "launch"
            ? "Você já aplicou um cupom de lançamento."
            : "Você já aplicou um cupom de indicação.",
        );
        return;
      }
      const error = await refreshGrid([...coupons, { code, ...checked.data }]);
      if (error) setCouponError(error);
      else setCouponInput("");
    });
  }

  function removeCoupon(code: string) {
    setCouponError(null);
    startTransition(async () => {
      const error = await refreshGrid(coupons.filter((c) => c.code !== code));
      if (error) setCouponError(error);
    });
  }

  const period = grid.periods.find((p) => p.code === periodCode) ?? grid.periods[0];
  const selectedQuote = period ? grid.quotes[planCode]?.[period.code] : undefined;

  return (
    <div className="space-y-6">
      {/* Em /planos o destaque abre o bloco; em /assinatura fica acima do campo de cupom. */}
      {mode === "public" && <div className="mx-auto max-w-xl">{banner}</div>}

      <div
        role="group"
        aria-label="Período de cobrança"
        className="mx-auto grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {grid.periods.map((p) => (
          <button
            key={p.code}
            type="button"
            aria-pressed={p.code === period?.code}
            onClick={() => setPeriodCode(p.code)}
            className={cn(
              "min-h-11 py-2 leading-tight rounded-xl border px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta",
              p.code === period?.code
                ? "border-violeta bg-violeta text-white"
                : "border-violeta/20 bg-white hover:bg-nevoa",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mx-auto max-w-xl">
        {mode === "account" && banner}

        {showCouponField && (
          <div className={mode === "account" && banner ? "mt-4" : undefined}>
            <FormField id="coupon" label="Cupom" error={couponError ?? undefined}>
              {(a) => (
                <div className="flex gap-2">
                  <Input
                    id={a.id}
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyCoupon();
                      }
                    }}
                    maxLength={40}
                    autoComplete="off"
                    autoCapitalize="characters"
                    placeholder="Digite o código"
                    invalid={a.invalid}
                    aria-describedby={a.describedBy}
                  />
                  <Button
                    variant="secondary"
                    className="shrink-0"
                    onClick={applyCoupon}
                    disabled={pending || couponInput.trim() === ""}
                  >
                    {pending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                    Aplicar
                  </Button>
                </div>
              )}
            </FormField>
            {coupons.length > 0 && (
              <ul className="mt-3 space-y-2">
                {coupons.map((c) => (
                  <li
                    key={c.code}
                    className="flex items-center justify-between gap-2 rounded-xl bg-nevoa px-3 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <Check size={14} className="mr-1 inline text-green-700" aria-hidden="true" />
                      {c.kind === "launch"
                        ? "Cupom de lançamento aplicado"
                        : `Cupom de indicação aplicado (mais ${c.extraPct.toLocaleString("pt-BR")} pontos de desconto)`}
                    </span>
                    <IconButton
                      label={`Remover cupom ${c.code}`}
                      onClick={() => removeCoupon(c.code)}
                      disabled={pending}
                    >
                      <X size={16} aria-hidden="true" />
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {grid.plans.map((plan) => {
          const quote = period ? grid.quotes[plan.code]?.[period.code] : undefined;
          const features = PLAN_FEATURE_LISTS[plan.code];
          const selected = mode === "account" && planCode === plan.code;
          return (
            <Card
              key={plan.code}
              className={cn(
                "flex flex-col",
                selected && "border-violeta ring-2 ring-violeta/30",
                plan.code === "loja" && mode === "public" && "border-violeta/30",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-xl font-extrabold">{plan.name}</h2>
                  <p className="text-sm text-tinta/70">{PLAN_TAGLINES[plan.code]}</p>
                </div>
                {currentPlan === plan.code && <Badge>Seu plano</Badge>}
              </div>

              {quote && period ? (
                <div className="mt-4" aria-live="polite">
                  {quote.savedCents > 0 && (
                    <p className="text-sm text-tinta/50 line-through">{cents(quote.listCents)}</p>
                  )}
                  <p className="text-3xl font-extrabold text-violeta-escuro">
                    {cents(quote.chargedCents)}
                    <span className="ml-1 text-sm font-semibold text-tinta/60">
                      {period.months === 1 ? "por mês" : `em ${period.months} meses`}
                    </span>
                  </p>
                  {period.months > 1 && (
                    <p className="text-sm text-tinta/70">
                      Equivale a {cents(quote.perMonthCents)} por mês
                    </p>
                  )}
                  <div className="mt-2">
                    <SavingsBadge quote={quote} />
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-tinta/60">Preço indisponível no momento.</p>
              )}

              {features && (
                <div className="mt-5 flex-1 space-y-4 text-sm">
                  <ul className="space-y-2">
                    {features.included.map((item) => (
                      <li key={item} className="flex gap-2">
                        <Check size={16} className="mt-0.5 shrink-0 text-violeta" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  {features.soon.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-tinta/50">
                        Em breve
                      </p>
                      <ul className="space-y-1.5 text-tinta/70">
                        {features.soon.map((item) => (
                          <li key={item} className="flex gap-2">
                            <Clock size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6">
                {mode === "public" ? (
                  <Link
                    href={signedIn ? "/assinatura" : "/cadastro"}
                    className={cn(buttonClasses({ size: "lg" }), "w-full")}
                  >
                    {signedIn ? "Escolher este plano" : "Começar teste grátis"}
                  </Link>
                ) : (
                  <Button
                    size="lg"
                    variant={selected ? "primary" : "secondary"}
                    className="w-full"
                    aria-pressed={selected}
                    onClick={() => setPlanCode(plan.code)}
                  >
                    {selected ? "Plano escolhido" : "Escolher este plano"}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {mode === "account" && selectedQuote && period && (
        <Card aria-live="polite">
          <h2 className="text-sm font-bold uppercase tracking-wide text-violeta-escuro">
            Resumo do preço
          </h2>
          <dl className="mt-3 divide-y divide-violeta/10 text-sm">
            <div className="flex justify-between py-2">
              <dt className="text-tinta/70">
                Preço normal ({period.months === 1 ? "1 mês" : `${period.months} meses`})
              </dt>
              <dd className="font-semibold">{cents(selectedQuote.listCents)}</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-tinta/70">
                Desconto ({selectedQuote.pctApplied.toLocaleString("pt-BR")}%)
              </dt>
              <dd className="font-semibold text-green-700">
                {selectedQuote.savedCents > 0 ? `- ${cents(selectedQuote.savedCents)}` : cents(0)}
              </dd>
            </div>
            <div className="flex justify-between py-2 text-base">
              <dt className="font-bold">Total</dt>
              <dd className="font-extrabold text-violeta-escuro">
                {cents(selectedQuote.chargedCents)}
              </dd>
            </div>
            {period.months > 1 && (
              <div className="flex justify-between py-2">
                <dt className="text-tinta/70">Equivalente por mês</dt>
                <dd className="font-semibold">{cents(selectedQuote.perMonthCents)}</dd>
              </div>
            )}
          </dl>
          <Button size="lg" className="mt-4 w-full" disabled>
            Assinar
          </Button>
          <p className="mt-2 text-center text-xs text-tinta/60">Pagamento em breve</p>
        </Card>
      )}
    </div>
  );
}
