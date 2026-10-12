"use client";

import type { ReactNode } from "react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";

const MAX_EXTRAS = 10;

interface ExtrasForm {
  extras: { label: string; value_brl: number }[];
  packaging_brl: number;
}

// Custos extras e embalagem do pedido. Precisa estar dentro de um FormProvider.
export function ExtrasList({ hint }: { hint?: ReactNode }) {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<ExtrasForm>();
  const lines = useFieldArray({ control, name: "extras" });
  const rootError = errors.extras?.root?.message;

  return (
    <div className="space-y-4">
      {lines.fields.length > 0 && (
        <ul className="space-y-3">
          {lines.fields.map((item, index) => (
            <li
              key={item.id}
              className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-start"
            >
              <FormField
                id={`extras-${index}-label`}
                label="Descrição"
                error={errors.extras?.[index]?.label?.message}
              >
                {(a11y) => (
                  <Input
                    {...register(`extras.${index}.label`)}
                    id={a11y.id}
                    maxLength={40}
                    placeholder="Ex.: Ímã, parafuso, tinta"
                    invalid={a11y.invalid}
                    aria-describedby={a11y.describedBy}
                  />
                )}
              </FormField>
              <Controller
                control={control}
                name={`extras.${index}.value_brl`}
                render={({ field, fieldState }) => (
                  <FormField
                    id={`extras-${index}-value`}
                    label="Valor"
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
                  onClick={() => lines.remove(index)}
                  aria-label={`Remover custo extra ${index + 1}`}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  <span className="sm:hidden">Remover</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {rootError && (
        <p role="alert" className="text-xs text-red-600">
          {rootError}
        </p>
      )}
      <Button
        variant="secondary"
        size="sm"
        onClick={() => lines.append({ label: "", value_brl: 0 })}
        disabled={lines.fields.length >= MAX_EXTRAS}
      >
        <Plus size={16} aria-hidden="true" />
        Adicionar custo extra
      </Button>
      {hint && <p className="text-xs text-tinta/60">{hint}</p>}

      <Controller
        control={control}
        name="packaging_brl"
        render={({ field, fieldState }) => (
          <div className="max-w-xs">
            <FormField
              id="packaging_brl"
              label="Embalagem do pedido"
              help="Uma por pedido, dividida entre as peças."
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
                  invalid={a11y.invalid}
                  aria-describedby={a11y.describedBy}
                />
              )}
            </FormField>
          </div>
        )}
      />
    </div>
  );
}
