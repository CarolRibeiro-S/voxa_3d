"use client";

import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { IntegerInput } from "@/components/ui/integer-input";
import { MoneyInput } from "@/components/ui/money-input";
import {
  costPerUnit,
  formatUnitCost,
  isSameMaterial,
  KIND_INFO,
  materialSchema,
  type MaterialValues,
} from "@/lib/materials-schema";
import type { Material, MaterialKind } from "@/types/database";
import { saveMaterial } from "./actions";

interface MaterialFormProps {
  kind: MaterialKind;
  material: Material | null;
  // Materiais ativos do mesmo tipo, para avisar sobre duplicados.
  activeMaterials: Material[];
  onDone: () => void;
  onCancel: () => void;
}

function toDefaults(kind: MaterialKind, m: Material | null): MaterialValues {
  return {
    kind,
    name: m?.name ?? "",
    brand: m?.brand ?? "",
    material_type: m?.material_type ?? "",
    color: m?.color ?? "",
    price_brl: m?.price_brl ?? 0,
    package_size: m?.package_size ?? (null as unknown as number),
    stock_remaining: m?.stock_remaining ?? null,
  };
}

export function MaterialForm({
  kind,
  material,
  activeMaterials,
  onDone,
  onCancel,
}: MaterialFormProps) {
  const info = KIND_INFO[kind];
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty, isValid },
  } = useForm<MaterialValues, unknown, MaterialValues>({
    resolver: zodResolver(materialSchema),
    defaultValues: toDefaults(kind, material),
    mode: "onChange",
  });

  const v = useWatch({ control });
  const cost = costPerUnit(v.price_brl ?? 0, v.package_size ?? null);

  const duplicate = activeMaterials.some(
    (other) =>
      other.id !== material?.id &&
      (v.name ?? "").trim() !== "" &&
      isSameMaterial(
        { name: v.name ?? "", brand: v.brand ?? "", color: v.color ?? "" },
        other,
      ),
  );

  function onSubmit(values: MaterialValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await saveMaterial(material?.id ?? null, values);
      if (result.ok) onDone();
      else setServerError(result.message);
    });
  }

  const datalistId = `material-types-${kind}`;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
        <div>
          <p className="mb-1.5 text-sm font-medium text-tinta">Tipo</p>
          <p className="flex min-h-11 items-center rounded-xl bg-nevoa px-4 text-sm font-semibold">
            {info.label}
          </p>
        </div>

        <FormField id="name" label="Nome" error={errors.name?.message}>
          {(a) => (
            <Input
              {...register("name")}
              id={a.id}
              invalid={a.invalid}
              aria-describedby={a.describedBy}
              autoComplete="off"
              maxLength={120}
              className="min-h-11"
            />
          )}
        </FormField>

        <FormField id="brand" label="Marca (opcional)" error={errors.brand?.message}>
          {(a) => (
            <Input
              {...register("brand")}
              id={a.id}
              invalid={a.invalid}
              aria-describedby={a.describedBy}
              autoComplete="off"
              className="min-h-11"
            />
          )}
        </FormField>

        <FormField
          id="material_type"
          label="Tipo de material (opcional)"
          help="Escolha uma sugestão ou digite outro"
          error={errors.material_type?.message}
        >
          {(a) => (
            <>
              <Input
                {...register("material_type")}
                id={a.id}
                invalid={a.invalid}
                aria-describedby={a.describedBy}
                autoComplete="off"
                list={datalistId}
                className="min-h-11"
              />
              <datalist id={datalistId}>
                {info.suggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </>
          )}
        </FormField>

        <FormField
          id="color"
          label="Cor (opcional)"
          help="Pode ser o nome da cor ou um código como #6D3BFF"
          error={errors.color?.message}
        >
          {(a) => (
            <Input
              {...register("color")}
              id={a.id}
              invalid={a.invalid}
              aria-describedby={a.describedBy}
              autoComplete="off"
              className="min-h-11"
            />
          )}
        </FormField>

        <Controller
          control={control}
          name="price_brl"
          render={({ field, fieldState }) => (
            <FormField id="price_brl" label="Preço pago" error={fieldState.error?.message}>
              {(a) => (
                <MoneyInput
                  ref={field.ref}
                  id={a.id}
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
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
          name="package_size"
          render={({ field, fieldState }) => (
            <FormField
              id="package_size"
              label={`Tamanho da embalagem (${info.unit})`}
              help={kind === "filament" ? "Por exemplo, 1000 g" : "Por exemplo, 1000 ml"}
              error={fieldState.error?.message}
            >
              {(a) => (
                <IntegerInput
                  ref={field.ref}
                  id={a.id}
                  name={field.name}
                  value={field.value}
                  onValueChange={(n) => field.onChange(n)}
                  onBlur={field.onBlur}
                  suffix={info.unit}
                  invalid={a.invalid}
                  aria-describedby={a.describedBy}
                />
              )}
            </FormField>
          )}
        />

        <Controller
          control={control}
          name="stock_remaining"
          render={({ field, fieldState }) => (
            <FormField
              id="stock_remaining"
              label={`Estoque restante em ${info.unit} (opcional)`}
              help="Deixe vazio se você não controla o estoque"
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
                  suffix={info.unit}
                  invalid={a.invalid}
                  aria-describedby={a.describedBy}
                />
              )}
            </FormField>
          )}
        />

        <div className="rounded-xl bg-nevoa p-4" aria-live="polite">
          {cost === null ? (
            <p className="text-sm text-tinta/70">Informe o tamanho para ver o custo</p>
          ) : (
            <p className="text-sm font-semibold">
              Custo {info.perUnit}:{" "}
              <span className="text-violeta">{formatUnitCost(cost)}</span>
            </p>
          )}
        </div>

        {duplicate && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
          >
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            Já existe um material ativo com o mesmo nome, marca e cor. Você pode
            salvar mesmo assim.
          </p>
        )}

        {serverError && (
          <p role="alert" className="text-sm text-red-600">
            {serverError}
          </p>
        )}
      </div>

      <div className="flex gap-3 border-t border-violeta/10 bg-white p-4 md:px-6">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={!isDirty || !isValid || pending}
          className="flex-1"
        >
          {pending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          Salvar
        </Button>
      </div>
    </form>
  );
}
