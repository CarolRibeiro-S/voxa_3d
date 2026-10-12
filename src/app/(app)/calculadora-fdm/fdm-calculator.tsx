"use client";

import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
  useWatch,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { IntegerField, SectionTitle, SELECT_CLASS } from "@/components/calculator/calc-fields";
import { ExtrasList } from "@/components/calculator/extras-list";
import { ResultPanel } from "@/components/calculator/result-panel";
import { SaveToQuote } from "@/components/calculator/save-to-quote";
import { useCalcRunner } from "@/components/calculator/use-calc-runner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import {
  fdmCalcSchema,
  MAX_MATERIALS,
  type FdmCalcInput,
  type FdmCalcValues,
} from "@/lib/fdm-calc-schema";
import { cn } from "@/lib/utils";
import { calculateFdm } from "./actions";

export interface SelectOption {
  id: string;
  label: string;
}

interface FdmCalculatorProps {
  printers: SelectOption[];
  materials: SelectOption[];
  defaults: { packaging_default_brl: number; default_margin_pct: number };
}

export function FdmCalculator({ printers, materials, defaults }: FdmCalculatorProps) {
  const methods = useForm<FdmCalcInput, unknown, FdmCalcValues>({
    resolver: zodResolver(fdmCalcSchema),
    defaultValues: {
      printer_id: printers.length === 1 ? printers[0].id : "",
      materials: [
        {
          material_id: materials.length === 1 ? materials[0].id : "",
          part_grams: 0,
          support_grams: 0,
        },
      ],
      print_hours: 0,
      print_minutes: 0,
      labor_minutes: 0,
      extras: [],
      packaging_brl: defaults.packaging_default_brl,
      quantity: 1,
      margin_pct: defaults.default_margin_pct,
    },
  });
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = methods;

  const materialLines = useFieldArray({ control, name: "materials" });
  const watched = useWatch({ control });
  const { submit, pending, result, error, stale, calculatedValues } = useCalcRunner(
    calculateFdm,
    JSON.stringify(watched),
  );

  const materialsRootError = errors.materials?.root?.message ?? errors.materials?.message;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <FormProvider {...methods}>
        <form onSubmit={(e) => void handleSubmit(submit)(e)} className="space-y-6" noValidate>
          <Card>
            <SectionTitle>Máquina e material</SectionTitle>
            <div className="space-y-4">
              <FormField id="printer_id" label="Máquina" error={errors.printer_id?.message}>
                {(a11y) => (
                  <select
                    {...register("printer_id")}
                    id={a11y.id}
                    aria-invalid={a11y.invalid || undefined}
                    aria-describedby={a11y.describedBy}
                    className={cn(
                      SELECT_CLASS,
                      a11y.invalid ? "border-red-500" : "border-violeta/20",
                    )}
                  >
                    <option value="">Selecione a máquina</option>
                    {printers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>

              <ul className="space-y-3">
                {materialLines.fields.map((item, index) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-violeta/10 bg-nevoa/60 p-3"
                  >
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_auto] sm:items-start">
                      <FormField
                        id={`materials-${index}-material`}
                        label={`Material ${index + 1}`}
                        error={errors.materials?.[index]?.material_id?.message}
                      >
                        {(a11y) => (
                          <select
                            {...register(`materials.${index}.material_id`)}
                            id={a11y.id}
                            aria-invalid={a11y.invalid || undefined}
                            aria-describedby={a11y.describedBy}
                            className={cn(
                              SELECT_CLASS,
                              a11y.invalid ? "border-red-500" : "border-violeta/20",
                            )}
                          >
                            <option value="">Selecione o material</option>
                            {materials.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </FormField>

                      <Controller
                        control={control}
                        name={`materials.${index}.part_grams`}
                        render={({ field, fieldState }) => (
                          <FormField
                            id={`materials-${index}-part`}
                            label="Peso da peça (g)"
                            error={fieldState.error?.message}
                          >
                            {(a11y) => (
                              <MoneyInput
                                ref={field.ref}
                                id={a11y.id}
                                name={field.name}
                                value={field.value ?? 0}
                                onValueChange={field.onChange}
                                onBlur={field.onBlur}
                                prefix=""
                                suffix="g"
                                decimals={1}
                                max={100_000}
                                invalid={a11y.invalid}
                                aria-describedby={a11y.describedBy}
                              />
                            )}
                          </FormField>
                        )}
                      />

                      <Controller
                        control={control}
                        name={`materials.${index}.support_grams`}
                        render={({ field, fieldState }) => (
                          <FormField
                            id={`materials-${index}-support`}
                            label="Peso do suporte (g)"
                            error={fieldState.error?.message}
                          >
                            {(a11y) => (
                              <MoneyInput
                                ref={field.ref}
                                id={a11y.id}
                                name={field.name}
                                value={field.value ?? 0}
                                onValueChange={field.onChange}
                                onBlur={field.onBlur}
                                prefix=""
                                suffix="g"
                                decimals={1}
                                max={100_000}
                                invalid={a11y.invalid}
                                aria-describedby={a11y.describedBy}
                              />
                            )}
                          </FormField>
                        )}
                      />

                      <div className="sm:pt-[1.625rem]">
                        <Button
                          variant="ghost"
                          className="w-full sm:w-11 sm:px-0"
                          onClick={() => materialLines.remove(index)}
                          disabled={materialLines.fields.length === 1}
                          aria-label={`Remover material ${index + 1}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                          <span className="sm:hidden">Remover</span>
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {materialsRootError && (
                <p role="alert" className="text-xs text-red-600">
                  {materialsRootError}
                </p>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  materialLines.append({ material_id: "", part_grams: 0, support_grams: 0 })
                }
                disabled={materialLines.fields.length >= MAX_MATERIALS}
              >
                <Plus size={16} aria-hidden="true" />
                Adicionar material
              </Button>
            </div>
          </Card>

          <Card>
            <SectionTitle>Tempo</SectionTitle>
            <div className="space-y-4">
              <fieldset>
                <legend className="mb-1.5 block text-sm font-medium text-tinta">
                  Tempo de impressão
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  <IntegerField
                    name="print_hours"
                    id="print_hours"
                    label="Horas"
                    suffix="h"
                    maxDigits={4}
                  />
                  <IntegerField
                    name="print_minutes"
                    id="print_minutes"
                    label="Minutos"
                    suffix="min"
                    maxDigits={2}
                  />
                </div>
              </fieldset>
              <IntegerField
                name="labor_minutes"
                id="labor_minutes"
                label="Seu tempo de preparo e acabamento (minutos)"
                help="Fatiar, preparar a mesa, tirar suportes, lixar e pintar."
                suffix="min"
                maxDigits={5}
              />
            </div>
          </Card>

          <Card>
            <SectionTitle>Custos extras</SectionTitle>
            <ExtrasList />
          </Card>

          <Card>
            <SectionTitle>Pedido</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <IntegerField
                name="quantity"
                id="quantity"
                label="Quantidade de peças"
                maxDigits={4}
              />
              <IntegerField
                name="margin_pct"
                id="margin_pct"
                label="Margem de lucro desta peça (%)"
                help="Muda só esta conta, não altera suas configurações."
                suffix="%"
                maxDigits={3}
              />
            </div>
          </Card>

          <div>
            <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
              {pending && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
              {pending ? "Calculando..." : "Calcular preço"}
            </Button>
          </div>
        </form>
      </FormProvider>

      <ResultPanel
        result={result}
        error={error}
        stale={stale}
        pending={pending}
        actions={
          result && calculatedValues ? (
            <SaveToQuote
              kind="fdm"
              input={calculatedValues}
              suggestedPrice={result.perUnit.price}
              disabled={stale || pending}
            />
          ) : null
        }
      />
    </div>
  );
}
