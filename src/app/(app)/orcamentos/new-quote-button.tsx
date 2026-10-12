"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PanelBody, PanelFooter, SidePanel } from "@/components/ui/side-panel";
import { newQuoteSchema, type NewQuoteValues } from "@/lib/quotes-schema";
import { createQuote } from "./actions";

function NewQuoteForm({ onCancel }: { onCancel: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewQuoteValues>({
    resolver: zodResolver(newQuoteSchema),
    defaultValues: { customer_name: "" },
  });

  function onSubmit(values: NewQuoteValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await createQuote(values);
      if (result.ok) router.push(`/orcamentos/${result.id}`);
      else setServerError(result.message);
    });
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
    >
      <PanelBody>
        <FormField id="new-customer" label="Nome do cliente" error={errors.customer_name?.message}>
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
        <p className="text-xs text-tinta/60">
          O orçamento começa como rascunho, com validade de 7 dias.
        </p>
        {serverError && (
          <p role="alert" className="text-sm text-red-600">
            {serverError}
          </p>
        )}
      </PanelBody>
      <PanelFooter>
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          Criar orçamento
        </Button>
      </PanelFooter>
    </form>
  );
}

export function NewQuoteButton({ label = "Novo orçamento" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} aria-hidden="true" />
        {label}
      </Button>
      <SidePanel open={open} onClose={() => setOpen(false)} title="Novo orçamento">
        <NewQuoteForm onCancel={() => setOpen(false)} />
      </SidePanel>
    </>
  );
}
