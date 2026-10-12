"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { quoteCustomerSchema, type QuoteCustomerValues } from "@/lib/quotes-schema";
import { updateQuoteCustomer } from "../actions";

export function CustomerForm({
  quoteId,
  initial,
}: {
  quoteId: string;
  initial: QuoteCustomerValues;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<QuoteCustomerValues>({
    resolver: zodResolver(quoteCustomerSchema),
    defaultValues: initial,
  });

  function onSubmit(values: QuoteCustomerValues) {
    setMessage(null);
    startTransition(async () => {
      const result = await updateQuoteCustomer(quoteId, values);
      if (result.ok) {
        reset(values);
        setMessage({ ok: true, text: "Dados salvos." });
      } else {
        setMessage({ ok: false, text: result.message });
      }
    });
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="space-y-4">
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

      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={message.ok ? "text-sm font-medium text-green-700" : "text-sm text-red-600"}
        >
          {message.text}
        </p>
      )}
      <Button type="submit" disabled={!isDirty || pending} className="w-full md:w-auto">
        {pending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
        Salvar dados do cliente
      </Button>
    </form>
  );
}
