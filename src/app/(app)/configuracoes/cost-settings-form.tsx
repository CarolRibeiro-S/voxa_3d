"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Controller,
  useForm,
  useWatch,
  type Control,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmSaveDialog } from "@/components/ui/confirm-save-dialog";
import { FormField } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { PercentInput } from "@/components/ui/percent-input";
import { useConfirmSubmit } from "@/hooks/use-confirm-submit";
import {
  costSettingsSchema,
  sumPercentCents,
  SUM_FIELDS,
  type CostSettingsValues,
} from "@/lib/cost-settings";
import { formatBRL, formatMoneyDigits, formatPercent } from "@/lib/format";
import type { CostSettings } from "@/types/database";
import {
  saveCostSettings,
  simulatePriceAction,
  type SimulationResult,
} from "./actions";

type FormControl = Control<CostSettingsValues, unknown, CostSettingsValues>;
type FieldName = keyof CostSettingsValues;

// Ao mudar um destes campos, a soma precisa ser revalidada nos outros.
const SUM_DEPS = [...SUM_FIELDS];

interface BaseFieldProps {
  control: FormControl;
  name: FieldName;
  label: string;
  help?: string;
  deps?: FieldName[];
}

function MoneyField({
  control,
  name,
  label,
  help,
  decimals = 2,
  max,
  suffix,
}: BaseFieldProps & { decimals?: number; max: number; suffix?: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormField id={name} label={label} help={help} error={fieldState.error?.message}>
          {(a11y) => (
            <MoneyInput
              ref={field.ref}
              id={a11y.id}
              name={field.name}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              decimals={decimals}
              max={max}
              suffix={suffix}
              invalid={a11y.invalid}
              aria-describedby={a11y.describedBy}
            />
          )}
        </FormField>
      )}
    />
  );
}

function PercentField({
  control,
  name,
  label,
  help,
  maxDigits = 3,
  decimals = 0,
  deps,
}: BaseFieldProps & { maxDigits?: number; decimals?: 0 | 2 }) {
  return (
    <Controller
      control={control}
      name={name}
      rules={{ deps }}
      render={({ field, fieldState }) => (
        <FormField id={name} label={label} help={help} error={fieldState.error?.message}>
          {(a11y) => (
            <PercentInput
              ref={field.ref}
              id={a11y.id}
              name={field.name}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              maxDigits={maxDigits}
              decimals={decimals}
              invalid={a11y.invalid}
              aria-describedby={a11y.describedBy}
            />
          )}
        </FormField>
      )}
    />
  );
}

// Margem e taxa de falha só aceitam inteiros: se o banco tiver decimais
// nesses dois, arredonda ao carregar. Os outros percentuais mantêm 2 casas.
function toFormValues(s: CostSettings): CostSettingsValues {
  return {
    energy_kwh_brl: s.energy_kwh_brl,
    labor_hour_brl: s.labor_hour_brl,
    packaging_default_brl: s.packaging_default_brl,
    failure_rate_pct: Math.round(s.failure_rate_pct),
    default_margin_pct: Math.round(s.default_margin_pct),
    marketplace_fee_pct: s.marketplace_fee_pct,
    payment_fee_pct: s.payment_fee_pct,
    tax_pct: s.tax_pct,
  };
}

export function CostSettingsForm({ settings }: { settings: CostSettings }) {
  const [saved, setSaved] = useState(false);
  const [exampleCost, setExampleCost] = useState(10);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [simPending, startSim] = useTransition();
  const simRequest = useRef(0);

  const form = useForm<CostSettingsValues, unknown, CostSettingsValues>({
    resolver: zodResolver(costSettingsSchema),
    defaultValues: toFormValues(settings),
    // Valida a cada digitação. Sem isso o padrão é validar só ao enviar.
    mode: "onChange",
  });
  const {
    handleSubmit,
    control,
    reset,
    getValues,
    formState: { isDirty, isValid },
  } = form;

  const brl = (v: unknown) => formatBRL(Number(v ?? 0));
  const pct = (v: unknown) => `${formatPercent(Number(v ?? 0))}%`;

  // Salvar pede confirmação com o resumo do que muda. Depois de salvar, os valores atuais
  // viram o novo ponto de partida.
  const confirmed = useConfirmSubmit({
    form,
    fields: [
      {
        name: "energy_kwh_brl",
        label: "Energia",
        format: (v) => `R$ ${formatMoneyDigits(Number(v ?? 0), 4)}/kWh`,
      },
      { name: "labor_hour_brl", label: "Valor da sua hora de trabalho", format: (v) => `${brl(v)}/hora` },
      { name: "packaging_default_brl", label: "Embalagem padrão por pedido", format: brl },
      { name: "failure_rate_pct", label: "Taxa de falha", format: pct },
      { name: "default_margin_pct", label: "Margem de lucro desejada", format: pct },
      { name: "marketplace_fee_pct", label: "Taxa do marketplace", format: pct },
      { name: "payment_fee_pct", label: "Taxa de pagamento", format: pct },
      { name: "tax_pct", label: "Imposto sobre a venda", format: pct },
    ],
    save: async (values) => {
      const result = await saveCostSettings(null, values);
      return result?.ok
        ? { ok: true }
        : { ok: false, message: result?.message ?? "Não foi possível salvar. Tente novamente." };
    },
    onSaved: () => {
      reset(getValues());
      setSaved(true);
    },
  });

  const v = useWatch({ control });
  const sumCents = sumPercentCents(v);
  const sum = sumCents / 100;
  const failurePct = v.failure_rate_pct ?? 0;
  const marginPct = v.default_margin_pct ?? 0;
  const marketplacePct = v.marketplace_fee_pct ?? 0;
  const paymentPct = v.payment_fee_pct ?? 0;
  const taxPct = v.tax_pct ?? 0;

  // O cálculo roda no servidor. Aqui só se envia a entrada e se mostra o resultado.
  useEffect(() => {
    const timer = setTimeout(() => {
      const request = ++simRequest.current;
      startSim(async () => {
        const result = await simulatePriceAction({
          baseCost: exampleCost,
          failurePct,
          marginPct,
          marketplacePct,
          paymentPct,
          taxPct,
        });
        // Ignora respostas de pedidos antigos.
        if (request === simRequest.current) setSimResult(result);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [exampleCost, failurePct, marginPct, marketplacePct, paymentPct, taxPct]);
  const sumTooHigh = sumCents >= 10_000;

  return (
    <Card>
      <h2 className="text-lg font-extrabold">Custos e margens</h2>
      <p className="mt-1 text-sm text-tinta/70">
        Estes valores serão usados nas calculadoras e nos orçamentos.
      </p>

      <form
        onSubmit={(e) => void handleSubmit(confirmed.onSubmit)(e)}
        className="mt-6 space-y-8"
        noValidate
      >
        <section>
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-violeta-escuro">
            Custos do dia a dia
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <MoneyField
              control={control}
              name="energy_kwh_brl"
              label="Energia"
              help="Veja na sua conta de luz o valor do kWh, com impostos"
              decimals={4}
              max={9999.9999}
              suffix="/kWh"
            />
            <MoneyField
              control={control}
              name="labor_hour_brl"
              label="Valor da sua hora de trabalho"
              help="Quanto vale uma hora do seu tempo"
              max={999999.99}
              suffix="/hora"
            />
            <MoneyField
              control={control}
              name="packaging_default_brl"
              label="Embalagem padrão por pedido"
              help="Caixa, fita, plástico bolha e etiqueta"
              max={999999.99}
            />
          </div>
        </section>

        <section>
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-violeta-escuro">
            Perdas
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <PercentField
              control={control}
              name="failure_rate_pct"
              label="Taxa de falha"
              help="Percentual de impressões que dão errado e precisam ser refeitas"
              maxDigits={2}
            />
          </div>
        </section>

        <section>
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-violeta-escuro">
            Preço e taxas
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <PercentField
              control={control}
              name="default_margin_pct"
              label="Margem de lucro desejada"
              help="Quanto do preço de venda fica de lucro"
              maxDigits={3}
              deps={SUM_DEPS}
            />
            <PercentField
              control={control}
              name="marketplace_fee_pct"
              label="Taxa do marketplace"
              help="Comissão cobrada pela plataforma de venda"
              maxDigits={3}
              decimals={2}
              deps={SUM_DEPS}
            />
            <PercentField
              control={control}
              name="payment_fee_pct"
              label="Taxa de pagamento, cartão ou Pix"
              help="Taxa cobrada pela maquininha ou pelo meio de pagamento"
              maxDigits={3}
              decimals={2}
              deps={SUM_DEPS}
            />
            <PercentField
              control={control}
              name="tax_pct"
              label="Imposto sobre a venda"
              help="Percentual de imposto sobre o preço de venda"
              maxDigits={3}
              decimals={2}
              deps={SUM_DEPS}
            />
          </div>
        </section>

        <section className="rounded-xl bg-nevoa p-4 md:p-5" aria-live="polite">
          <p
            className={
              sumTooHigh
                ? "text-sm font-semibold text-red-600"
                : "text-sm font-semibold text-tinta"
            }
          >
            Soma de margem, taxas e imposto: {formatPercent(sum)}%
          </p>

          <div className="mt-4 max-w-sm">
            <FormField
              id="example-cost"
              label="Custo de uma peça de exemplo (material, energia e máquina)"
              help="Apenas um exemplo desta tela, não é salvo."
            >
              {(a11y) => (
                <MoneyInput
                  id={a11y.id}
                  value={exampleCost}
                  onValueChange={setExampleCost}
                  max={999999.99}
                  aria-describedby={a11y.describedBy}
                />
              )}
            </FormField>
          </div>

          {simResult === null ? (
            <p className="mt-4 text-sm text-tinta/60" role="status">
              Calculando...
            </p>
          ) : simResult.ok ? (
            <dl
              className={`mt-4 grid gap-3 transition-opacity sm:grid-cols-3 ${simPending ? "opacity-60" : ""}`}
              aria-busy={simPending}
            >
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <dt className="text-xs text-tinta/60">Custo total</dt>
                <dd className="font-bold">{formatBRL(simResult.totalCost)}</dd>
              </div>
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <dt className="text-xs text-tinta/60">Preço de venda</dt>
                <dd className="font-bold text-violeta">{formatBRL(simResult.price)}</dd>
              </div>
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <dt className="text-xs text-tinta/60">Lucro estimado</dt>
                <dd className="font-bold">{formatBRL(simResult.profit)}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-sm text-red-600" role="status">
              {simResult.message}
            </p>
          )}

          <p className="mt-3 text-xs text-tinta/60">
            O cálculo considera custos, taxa de falha e margem definidos acima.
          </p>
        </section>

        {confirmed.notice && (
          <p role="status" className="text-sm font-medium text-tinta/70">
            {confirmed.notice}
          </p>
        )}
        {saved && !isDirty && (
          <p role="status" className="text-sm font-medium text-green-700">
            Configurações salvas.
          </p>
        )}

        <Button type="submit" disabled={!isValid} className="w-full md:w-auto">
          Salvar configurações
        </Button>
        <ConfirmSaveDialog {...confirmed.dialog} />
      </form>
    </Card>
  );
}
