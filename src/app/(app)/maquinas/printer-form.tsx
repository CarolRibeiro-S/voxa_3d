"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { IntegerInput } from "@/components/ui/integer-input";
import { MoneyInput } from "@/components/ui/money-input";
import { Textarea } from "@/components/ui/textarea";
import {
  POWER_BASIS_LABEL,
  PRINTER_TYPE_LABEL,
  PRINTER_TYPES,
  printerSchema,
  type CatalogPrinterView,
  type PrinterValues,
} from "@/lib/printers-schema";
import { cn } from "@/lib/utils";
import type { TenantPrinter } from "@/types/database";
import { getCatalogPrinter, savePrinter } from "./actions";

interface PrinterFormProps {
  printer: TenantPrinter | null;
  // Preenchimento vindo da máquina escolhida no catálogo (somente criação).
  catalog: CatalogPrinterView | null;
  onDone: () => void;
  onBack: (() => void) | null;
  onCancel: () => void;
}

function toDefaults(
  printer: TenantPrinter | null,
  catalog: CatalogPrinterView | null,
): PrinterValues {
  if (printer) {
    return {
      type: printer.type,
      nickname: printer.nickname ?? "",
      brand: printer.brand,
      model: printer.model,
      power_w: printer.power_w === null ? null : Math.round(printer.power_w),
      price_brl: printer.price_brl,
      lifespan_hours: printer.lifespan_hours,
      maintenance_brl_per_hour: printer.maintenance_brl_per_hour,
      notes: printer.notes ?? "",
    };
  }
  return {
    type: catalog?.type ?? "fdm",
    nickname: "",
    brand: catalog?.brand ?? "",
    model: catalog?.model ?? "",
    power_w:
      catalog?.avgPowerW != null && catalog.avgPowerW > 0
        ? Math.round(catalog.avgPowerW)
        : null,
    price_brl: catalog?.priceRefBrl ?? null,
    lifespan_hours: null,
    maintenance_brl_per_hour: 0,
    notes: "",
  };
}

const yesNo = (v: boolean | null) => (v === null ? null : v ? "Sim" : "Não");

export function PrinterForm({
  printer,
  catalog,
  onDone,
  onBack,
  onCancel,
}: PrinterFormProps) {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = printer !== null;
  // Na edição de máquina do catálogo, os recursos vêm de uma consulta única.
  const [fetched, setFetched] = useState<CatalogPrinterView | null>(null);
  const requested = useRef(false);
  // Marca e modelo vindos do catálogo ficam somente leitura.
  const lockIdentity = catalog !== null || printer?.catalog_id != null;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty, isValid },
  } = useForm<PrinterValues, unknown, PrinterValues>({
    resolver: zodResolver(printerSchema),
    defaultValues: toDefaults(printer, catalog),
    mode: "onChange",
  });

  useEffect(() => {
    if (!printer?.catalog_id || requested.current) return;
    requested.current = true;
    // Se falhar ou estourar o limite, o formulário segue sem os recursos.
    getCatalogPrinter(printer.brand, printer.model).then((result) => {
      if (result.ok) setFetched(result.printer);
    });
  }, [printer]);

  function onSubmit(values: PrinterValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await savePrinter(
        printer?.id ?? null,
        values,
        printer ? null : (catalog?.catalogId ?? null),
      );
      if (result.ok) onDone();
      else setServerError(result.message);
    });
  }

  const readOnlyClass = "bg-nevoa text-tinta/80";
  const info = catalog ?? fetched;
  const features = info
    ? [
        ["Área de impressão", info.buildArea],
        ["Fechada", yesNo(info.enclosed)],
        ["Bico endurecido", yesNo(info.hardenedNozzle)],
        ["Multicor", yesNo(info.multicolor)],
        [
          "Tela",
          info.screenSizeIn === null
            ? null
            : `${new Intl.NumberFormat("pt-BR").format(info.screenSizeIn)} pol`,
        ],
      ].filter((f): f is [string, string] => f[1] !== null)
    : [];

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
        {lockIdentity ? (
          <div>
            <p className="mb-1.5 text-sm font-medium text-tinta">Tipo</p>
            <p className="flex min-h-11 items-center rounded-xl bg-nevoa px-4 text-sm font-semibold">
              {PRINTER_TYPE_LABEL[printer?.type ?? catalog?.type ?? "fdm"]}
            </p>
          </div>
        ) : (
          <FormField id="type" label="Tipo" error={errors.type?.message}>
            {(a) => (
              <select
                {...register("type")}
                id={a.id}
                aria-describedby={a.describedBy}
                className="min-h-11 w-full rounded-xl border border-violeta/20 bg-white px-4 text-sm text-tinta shadow-sm outline-none focus:border-violeta focus:ring-2 focus:ring-violeta/20"
              >
                {PRINTER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {PRINTER_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="brand" label="Marca" error={errors.brand?.message}>
            {(a) => (
              <Input
                {...register("brand")}
                id={a.id}
                invalid={a.invalid}
                aria-describedby={a.describedBy}
                readOnly={lockIdentity}
                autoComplete="off"
                className={cn("min-h-11", lockIdentity && readOnlyClass)}
              />
            )}
          </FormField>
          <FormField id="model" label="Modelo" error={errors.model?.message}>
            {(a) => (
              <Input
                {...register("model")}
                id={a.id}
                invalid={a.invalid}
                aria-describedby={a.describedBy}
                readOnly={lockIdentity}
                autoComplete="off"
                className={cn("min-h-11", lockIdentity && readOnlyClass)}
              />
            )}
          </FormField>
        </div>

        <FormField
          id="nickname"
          label="Apelido (opcional)"
          help='Por exemplo, "A1 da bancada"'
          error={errors.nickname?.message}
        >
          {(a) => (
            <Input
              {...register("nickname")}
              id={a.id}
              invalid={a.invalid}
              aria-describedby={a.describedBy}
              autoComplete="off"
              className="min-h-11"
            />
          )}
        </FormField>

        {features.length > 0 && (
          <dl className="grid grid-cols-2 gap-3 rounded-xl bg-nevoa p-4 text-sm">
            {features.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-tinta/60">{label}</dt>
                <dd className="font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        <Controller
          control={control}
          name="power_w"
          render={({ field, fieldState }) => (
            <FormField
              id="power_w"
              label="Consumo médio (W)"
              help={
                catalog?.avgPowerW != null
                  ? "Valor sugerido. Confira na sua máquina ou com um medidor de tomada e ajuste se precisar."
                  : undefined
              }
              error={fieldState.error?.message}
            >
              {(a) => (
                <>
                  <IntegerInput
                    ref={field.ref}
                    id={a.id}
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    maxDigits={5}
                    suffix="W"
                    invalid={a.invalid}
                    aria-describedby={a.describedBy}
                  />
                  {catalog?.powerBasis && catalog.avgPowerW != null && (
                    <Badge className="mt-2 bg-nevoa text-violeta-escuro">
                      {catalog.powerBasis === "estimativa" && (
                        <Info size={12} className="mr-1" aria-hidden="true" />
                      )}
                      {POWER_BASIS_LABEL[catalog.powerBasis]}
                    </Badge>
                  )}
                </>
              )}
            </FormField>
          )}
        />

        <Controller
          control={control}
          name="price_brl"
          render={({ field, fieldState }) => (
            <FormField
              id="price_brl"
              label="Preço da máquina (R$)"
              help={
                catalog?.priceRefBrl != null && catalog.priceRefLabel
                  ? `Preço de referência de ${catalog.priceRefLabel}`
                  : "Deixe em 0,00 se não quiser informar"
              }
              error={fieldState.error?.message}
            >
              {(a) => (
                <MoneyInput
                  ref={field.ref}
                  id={a.id}
                  name={field.name}
                  value={field.value ?? 0}
                  // Zero significa "não informado" e vira vazio no banco.
                  onValueChange={(n) => field.onChange(n === 0 ? null : n)}
                  onBlur={field.onBlur}
                  max={99999999.99}
                  invalid={a.invalid}
                  aria-describedby={a.describedBy}
                />
              )}
            </FormField>
          )}
        />

        <Controller
          control={control}
          name="lifespan_hours"
          render={({ field, fieldState }) => (
            <FormField
              id="lifespan_hours"
              label="Vida útil estimada (horas)"
              help="Usado para calcular o desgaste da máquina por hora (preço dividido pela vida útil). Se não souber, deixe em branco e preencha depois."
              error={fieldState.error?.message}
            >
              {(a) => (
                <IntegerInput
                  ref={field.ref}
                  id={a.id}
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  maxDigits={6}
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
          name="maintenance_brl_per_hour"
          render={({ field, fieldState }) => (
            <FormField
              id="maintenance_brl_per_hour"
              label="Manutenção por hora (R$)"
              help="Peças e manutenção, em média, por hora de impressão"
              error={fieldState.error?.message}
            >
              {(a) => (
                <MoneyInput
                  ref={field.ref}
                  id={a.id}
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  max={999999.99}
                  suffix="/hora"
                  invalid={a.invalid}
                  aria-describedby={a.describedBy}
                />
              )}
            </FormField>
          )}
        />

        <FormField
          id="notes"
          label="Observações (opcional)"
          error={errors.notes?.message}
        >
          {(a) => (
            <Textarea
              {...register("notes")}
              id={a.id}
              invalid={a.invalid}
              aria-describedby={a.describedBy}
              maxLength={400}
            />
          )}
        </FormField>

        {serverError && (
          <p role="alert" className="text-sm text-red-600">
            {serverError}
          </p>
        )}
      </div>

      <div className="flex gap-3 border-t border-violeta/10 bg-white p-4 md:px-6">
        <Button
          type="button"
          variant="secondary"
          onClick={onBack ?? onCancel}
          className="flex-1"
        >
          {onBack ? "Voltar" : "Cancelar"}
        </Button>
        <Button
          type="submit"
          // Em edição precisa haver mudança. Na criação basta estar válido.
          disabled={!isValid || (isEdit && !isDirty) || pending}
          className="flex-1"
        >
          {pending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          Salvar
        </Button>
      </div>
    </form>
  );
}
