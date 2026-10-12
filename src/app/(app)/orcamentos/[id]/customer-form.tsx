"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { ConfirmSaveDialog } from "@/components/ui/confirm-save-dialog";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useConfirmSubmit } from "@/hooks/use-confirm-submit";
import { formatContact, formatDate } from "@/lib/format";
import { quoteCustomerSchema, type QuoteCustomerValues } from "@/lib/quotes-schema";
import { updateQuoteCustomer } from "../actions";

export function CustomerForm({
  quoteId,
  initial,
  readOnly = false,
}: {
  quoteId: string;
  initial: QuoteCustomerValues;
  // Orçamento aprovado ou recusado: só leitura.
  readOnly?: boolean;
}) {
  const [saved, setSaved] = useState(false);
  const form = useForm<QuoteCustomerValues>({
    resolver: zodResolver(quoteCustomerSchema),
    defaultValues: initial,
  });
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isDirty },
  } = form;

  // Salvar pede confirmação com o resumo do que muda.
  const confirmed = useConfirmSubmit({
    form,
    fields: [
      { name: "customer_name", label: "Nome do cliente" },
      {
        name: "customer_contact",
        label: "Contato",
        format: (v) => formatContact(String(v ?? "")),
      },
      {
        name: "valid_until",
        label: "Válido até",
        format: (v) => (v ? formatDate(String(v)) : ""),
      },
      { name: "notes", label: "Observações" },
    ],
    save: (values) => updateQuoteCustomer(quoteId, values),
    onSaved: () => {
      reset(getValues());
      setSaved(true);
    },
  });

  return (
    <form
      onSubmit={(e) => void handleSubmit(confirmed.onSubmit)(e)}
      noValidate
      className="space-y-4"
    >
      <fieldset disabled={readOnly} className="min-w-0 space-y-4 border-0 p-0">
      <div className="grid gap-4 md:grid-cols-2">
        <FormField id="customer_name" label="Nome do cliente" error={errors.customer_name?.message}>
          {(a) => (
            <Input
              {...register("customer_name")}
              id={a.id}
              autoComplete="off"
              maxLength={120}
              invalid={a.invalid}
              aria-describedby={a.describedBy}
            />
          )}
        </FormField>
        <FormField
          id="customer_contact"
          label="Contato (WhatsApp ou e-mail)"
          error={errors.customer_contact?.message}
        >
          {(a) => (
            <Input
              {...register("customer_contact")}
              id={a.id}
              autoComplete="off"
              maxLength={120}
              invalid={a.invalid}
              aria-describedby={a.describedBy}
            />
          )}
        </FormField>
        <FormField id="valid_until" label="Válido até" error={errors.valid_until?.message}>
          {(a) => (
            <Input
              {...register("valid_until")}
              id={a.id}
              type="date"
              invalid={a.invalid}
              aria-describedby={a.describedBy}
            />
          )}
        </FormField>
      </div>
      <FormField id="notes" label="Observações" error={errors.notes?.message}>
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

      </fieldset>

      {!readOnly && (
        <>
          {confirmed.notice && (
            <p role="status" className="text-sm font-medium text-tinta/70">
              {confirmed.notice}
            </p>
          )}
          {saved && !isDirty && (
            <p role="status" className="text-sm font-medium text-green-700">
              Dados salvos.
            </p>
          )}
          <Button type="submit" className="w-full md:w-auto">
            Salvar dados do cliente
          </Button>
          <ConfirmSaveDialog {...confirmed.dialog} />
        </>
      )}
    </form>
  );
}
