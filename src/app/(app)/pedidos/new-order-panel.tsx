"use client";

import { useState, useTransition } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { IntegerInput } from "@/components/ui/integer-input";
import { MoneyInput } from "@/components/ui/money-input";
import { PanelBody, PanelFooter, SidePanel } from "@/components/ui/side-panel";
import { Textarea } from "@/components/ui/textarea";
import { formatPhone, normalizePhoneDigits } from "@/lib/format";
import {
  createOrderSchema,
  MAX_ORDER_ITEMS,
  ORDER_KIND_LABEL,
  ORDER_KINDS,
  type CreateOrderInput,
  type CreateOrderValues,
} from "@/lib/orders";
import { cn } from "@/lib/utils";
import { createOrder } from "./actions";

function NewOrderForm({ onClose }: { onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<CreateOrderInput, unknown, CreateOrderValues>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      kind: "client",
      client_name: "",
      client_phone: "",
      due_date: "",
      notes: "",
      items: [{ description: "", quantity: 1, unit_price: 0 }],
    },
  });
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = form;
  const lines = useFieldArray({ control, name: "items" });
  const kind = useWatch({ control, name: "kind" });
  const isClient = kind === "client";

  // Criar não pede confirmação.
  function onSubmit(values: CreateOrderValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await createOrder(values);
      if (result.ok) onClose();
      else setServerError(result.message);
    });
  }

  const itemsRootError = errors.items?.root?.message ?? errors.items?.message;

  return (
    <form
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
    >
      <PanelBody>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-tinta">Tipo do pedido</legend>
          <div className="grid grid-cols-2 gap-2">
            {ORDER_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setValue("kind", k, { shouldValidate: true })}
                className={cn(
                  "min-h-11 py-2 leading-tight rounded-xl border px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta",
                  kind === k
                    ? "border-violeta bg-violeta text-white"
                    : "border-violeta/20 bg-white hover:bg-nevoa",
                )}
              >
                {ORDER_KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </fieldset>

        {isClient && (
          <>
            <FormField id="new-customer" label="Nome do cliente" error={errors.client_name?.message}>
              {(a) => (
                <Input
                  {...register("client_name")}
                  id={a.id}
                  maxLength={120}
                  autoComplete="off"
                  invalid={a.invalid}
                  aria-describedby={a.describedBy}
                />
              )}
            </FormField>
            <Controller
              control={control}
              name="client_phone"
              render={({ field, fieldState }) => (
                <FormField id="new-phone" label="Telefone (opcional)" error={fieldState.error?.message}>
                  {(a) => (
                    <Input
                      ref={field.ref}
                      id={a.id}
                      name={field.name}
                      type="tel"
                      inputMode="tel"
                      autoComplete="off"
                      maxLength={20}
                      placeholder="(61) 99999-0000"
                      value={formatPhone(field.value ?? "")}
                      onChange={(e) => field.onChange(normalizePhoneDigits(e.target.value).slice(0, 13))}
                      onBlur={field.onBlur}
                      invalid={a.invalid}
                      aria-describedby={a.describedBy}
                    />
                  )}
                </FormField>
              )}
            />
          </>
        )}

        <FormField id="new-due" label="Prazo de entrega (opcional)" error={errors.due_date?.message}>
          {(a) => (
            <Input
              {...register("due_date")}
              id={a.id}
              type="date"
              invalid={a.invalid}
              aria-describedby={a.describedBy}
            />
          )}
        </FormField>

        <section aria-labelledby="new-items" className="space-y-3">
          <h3 id="new-items" className="text-sm font-bold uppercase tracking-wide text-violeta-escuro">
            Itens
          </h3>
          <ul className="space-y-3">
            {lines.fields.map((item, index) => (
              <li key={item.id} className="space-y-3 rounded-xl border border-violeta/10 bg-nevoa/60 p-3">
                <FormField
                  id={`new-item-${index}-description`}
                  label="Descrição"
                  error={errors.items?.[index]?.description?.message}
                >
                  {(a) => (
                    <Input
                      {...register(`items.${index}.description`)}
                      id={a.id}
                      maxLength={120}
                      autoComplete="off"
                      invalid={a.invalid}
                      aria-describedby={a.describedBy}
                    />
                  )}
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <Controller
                    control={control}
                    name={`items.${index}.quantity`}
                    render={({ field, fieldState }) => (
                      <FormField
                        id={`new-item-${index}-qty`}
                        label="Quantidade"
                        error={fieldState.error?.message}
                      >
                        {(a) => (
                          <IntegerInput
                            ref={field.ref}
                            id={a.id}
                            name={field.name}
                            value={field.value}
                            onValueChange={(next) => field.onChange(next ?? 0)}
                            onBlur={field.onBlur}
                            maxDigits={4}
                            invalid={a.invalid}
                            aria-describedby={a.describedBy}
                          />
                        )}
                      </FormField>
                    )}
                  />
                  <Controller
                    control={control}
                    name={`items.${index}.unit_price`}
                    render={({ field, fieldState }) => (
                      <FormField
                        id={`new-item-${index}-price`}
                        label="Valor unitário"
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
                            invalid={a.invalid}
                            aria-describedby={a.describedBy}
                          />
                        )}
                      </FormField>
                    )}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-11"
                  onClick={() => lines.remove(index)}
                  disabled={lines.fields.length === 1}
                  aria-label={`Remover item ${index + 1}`}
title={`Remover item ${index + 1}`}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  Remover
                </Button>
              </li>
            ))}
          </ul>
          {itemsRootError && (
            <p role="alert" className="text-xs text-red-600">
              {itemsRootError}
            </p>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => lines.append({ description: "", quantity: 1, unit_price: 0 })}
            disabled={lines.fields.length >= MAX_ORDER_ITEMS}
          >
            <Plus size={16} aria-hidden="true" />
            Adicionar item
          </Button>
        </section>

        <FormField id="new-notes" label="Observações (opcional)" error={errors.notes?.message}>
          {(a) => (
            <Textarea
              {...register("notes")}
              id={a.id}
              maxLength={1000}
              invalid={a.invalid}
              aria-describedby={a.describedBy}
            />
          )}
        </FormField>

        {serverError && (
          <p role="alert" className="text-sm text-red-600">
            {serverError}
          </p>
        )}
      </PanelBody>
      <PanelFooter>
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          Criar pedido
        </Button>
      </PanelFooter>
    </form>
  );
}

export function NewOrderPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <SidePanel open={open} onClose={onClose} title="Novo pedido">
      <NewOrderForm onClose={onClose} />
    </SidePanel>
  );
}
