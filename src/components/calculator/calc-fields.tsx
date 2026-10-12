"use client";

import type { ReactNode } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { FormField } from "@/components/ui/field";
import { IntegerInput } from "@/components/ui/integer-input";

export const SELECT_CLASS =
  "min-h-11 w-full rounded-xl border bg-white px-4 text-sm text-tinta shadow-sm outline-none focus:border-violeta focus:ring-2 focus:ring-violeta/20";

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-violeta-escuro">
      {children}
    </h2>
  );
}

export type IntegerFieldName =
  | "print_hours"
  | "print_minutes"
  | "labor_minutes"
  | "quantity"
  | "piecesPerPlate"
  | "margin_pct";

type IntegerForm = Record<IntegerFieldName, number>;

// Precisa estar dentro de um FormProvider.
export function IntegerField({
  name,
  id,
  label,
  help,
  suffix,
  maxDigits,
}: {
  name: IntegerFieldName;
  id: string;
  label: string;
  help?: string;
  suffix?: string;
  maxDigits: number;
}) {
  const { control } = useFormContext<IntegerForm>();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormField id={id} label={label} help={help} error={fieldState.error?.message}>
          {(a11y) => (
            <IntegerInput
              ref={field.ref}
              id={a11y.id}
              name={field.name}
              value={field.value ?? 0}
              onValueChange={(next) => field.onChange(next ?? 0)}
              onBlur={field.onBlur}
              maxDigits={maxDigits}
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
