"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChangesSummary } from "@/components/ui/changes-summary";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/field";
import { IntegerInput } from "@/components/ui/integer-input";
import { MoneyInput } from "@/components/ui/money-input";
import { PercentInput } from "@/components/ui/percent-input";
import { costSettingsToValues } from "@/lib/cost-settings";
import { formatBRL } from "@/lib/format";
import { hourlyRateSchema, type HourlyRateInput } from "@/lib/hourly-rate-schema";
import type { CostSettings } from "@/types/database";
import { saveCostSettings } from "../configuracoes/actions";
import { calculateHourlyRate } from "./actions";

// A conta é feita no servidor. Aqui só se envia a entrada e se mostra o resultado.
export function HourlyRateCard({ settings }: { settings: CostSettings | null }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saved, setSaved] = useState(false);

  const { control, handleSubmit } = useForm<HourlyRateInput>({
    resolver: zodResolver(hourlyRateSchema),
    defaultValues: { monthly_goal_brl: 0, hours_per_week: 40, productive_pct: 70 },
  });

  function onSubmit(values: HourlyRateInput) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const response = await calculateHourlyRate(values);
      if (response.ok) setResult(response.value);
      else {
        setResult(null);
        setError(response.message);
      }
    });
  }

  return (
    <Card id="valor-hora" data-tour="painel-hora" className="scroll-mt-6">
      <h2 className="text-lg font-extrabold">Quanto cobrar pela sua hora?</h2>
      <p className="mt-1 text-sm text-tinta/70">
        Descubra o valor da hora de trabalho a partir do quanto você quer ganhar por mês. É um
        cálculo de apoio: o resultado muda se você mudar os números.
      </p>

      <form
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        noValidate
        className="mt-5 grid gap-4 md:grid-cols-3"
      >
        <Controller
          control={control}
          name="monthly_goal_brl"
          render={({ field, fieldState }) => (
            <FormField
              id="hr-goal"
              label="Quanto você quer ganhar por mês (R$)"
              error={fieldState.error?.message}
            >
              {(a) => (
                <MoneyInput
                  ref={field.ref}
                  id={a.id}
                  name={field.name}
                  value={field.value ?? 0}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  max={100_000}
                  invalid={a.invalid}
                  aria-describedby={a.describedBy}
                />
              )}
            </FormField>
          )}
        />
        <Controller
          control={control}
          name="hours_per_week"
          render={({ field, fieldState }) => (
            <FormField
              id="hr-hours"
              label="Horas que você trabalha por semana"
              error={fieldState.error?.message}
            >
              {(a) => (
                <IntegerInput
                  ref={field.ref}
                  id={a.id}
                  name={field.name}
                  value={field.value ?? null}
                  onValueChange={(next) => field.onChange(next ?? 0)}
                  onBlur={field.onBlur}
                  maxDigits={2}
                  suffix="h"
                  invalid={a.invalid}
                  aria-describedby={a.describedBy}
                />
              )}
            </FormField>
          )}
        />
        <Controller
          control={control}
          name="productive_pct"
          render={({ field, fieldState }) => (
            <FormField
              id="hr-pct"
              label="Percentual do tempo em que você realmente produz"
              help="O resto é atendimento, compras, embalagem e imprevistos."
              error={fieldState.error?.message}
            >
              {(a) => (
                <PercentInput
                  ref={field.ref}
                  id={a.id}
                  name={field.name}
                  value={field.value ?? 0}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  maxDigits={3}
                  invalid={a.invalid}
                  aria-describedby={a.describedBy}
                />
              )}
            </FormField>
          )}
        />

        <div className="md:col-span-3">
          <Button type="submit" disabled={pending} className="w-full md:w-auto">
            {pending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            Calcular minha hora
          </Button>
        </div>
      </form>

      <div aria-live="polite">
        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {result !== null && (
          <div className="mt-4 rounded-xl bg-nevoa p-4">
            <p className="text-sm text-tinta/70">Sua hora de trabalho</p>
            <p className="text-3xl font-extrabold text-violeta-escuro">{formatBRL(result)}</p>
            {settings ? (
              <Button className="mt-3 w-full md:w-auto" onClick={() => setConfirming(true)}>
                Usar este valor na minha hora de trabalho
              </Button>
            ) : (
              <p className="mt-2 text-xs text-tinta/60">
                Não encontramos as suas configurações de custo para gravar o valor.
              </p>
            )}
          </div>
        )}
        {saved && (
          <p role="status" className="mt-4 text-sm font-medium text-green-700">
            Valor da hora de trabalho atualizado nas suas configurações.
          </p>
        )}
      </div>

      {settings && result !== null && (
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title="Usar este valor?"
          description="Confira o que vai mudar nas suas configurações."
          confirmLabel="Salvar alteração"
          cancelLabel="Voltar e revisar"
          onConfirm={async () => {
            const response = await saveCostSettings(null, {
              ...costSettingsToValues(settings),
              labor_hour_brl: result,
            });
            if (!response?.ok) {
              return { ok: false, message: response?.message ?? "Não foi possível salvar. Tente novamente." };
            }
            setSaved(true);
            return { ok: true };
          }}
        >
          <ChangesSummary
            changes={[
              {
                label: "Valor da sua hora de trabalho",
                from: `${formatBRL(settings.labor_hour_brl)}/hora`,
                to: `${formatBRL(result)}/hora`,
              },
            ]}
          />
        </ConfirmDialog>
      )}
    </Card>
  );
}
