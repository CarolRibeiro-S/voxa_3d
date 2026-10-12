"use client";

import { Controller, useFormContext } from "react-hook-form";
import { FormField } from "@/components/ui/field";
import { IntegerInput } from "@/components/ui/integer-input";

interface PlateSwitchProps {
  multi: boolean;
  onMultiChange: (next: boolean) => void;
}

// Interruptor "Várias peças na mesma impressão" e o campo "Peças por mesa". Desligado, o valor
// volta para 1 e a calculadora se comporta como sempre. Precisa estar dentro de um FormProvider.
export function PlateSwitch({ multi, onMultiChange }: PlateSwitchProps) {
  const { control, setValue } = useFormContext<{ piecesPerPlate: number }>();

  return (
    <div className="space-y-3 rounded-xl border border-violeta/10 bg-nevoa/60 p-3">
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          role="switch"
          checked={multi}
          onChange={(e) => {
            onMultiChange(e.target.checked);
            setValue("piecesPerPlate", e.target.checked ? 2 : 1, { shouldDirty: true });
          }}
          className="size-5 accent-violeta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta"
        />
        Várias peças na mesma impressão
      </label>

      {multi && (
        <>
          <Controller
            control={control}
            name="piecesPerPlate"
            render={({ field, fieldState }) => (
              <div className="max-w-xs">
                <FormField
                  id="piecesPerPlate"
                  label="Peças por mesa"
                  help="Mínimo 2."
                  error={fieldState.error?.message}
                >
                  {(a11y) => (
                    <IntegerInput
                      ref={field.ref}
                      id={a11y.id}
                      name={field.name}
                      value={field.value ?? 2}
                      onValueChange={(next) => field.onChange(next ?? 2)}
                      onBlur={() => {
                        // Com o interruptor ligado o mínimo é 2.
                        if ((field.value ?? 0) < 2) field.onChange(2);
                        field.onBlur();
                      }}
                      maxDigits={4}
                      invalid={a11y.invalid}
                      aria-describedby={a11y.describedBy}
                    />
                  )}
                </FormField>
              </div>
            )}
          />
          <p className="text-xs text-tinta/70">
            Digite os valores da mesa inteira, como aparecem no fatiador. O sistema divide por
            peça.
          </p>
        </>
      )}
    </div>
  );
}
