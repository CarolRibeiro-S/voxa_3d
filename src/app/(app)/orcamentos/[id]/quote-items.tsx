"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { IntegerInput } from "@/components/ui/integer-input";
import { MoneyInput } from "@/components/ui/money-input";
import { PanelBody, PanelFooter, SidePanel } from "@/components/ui/side-panel";
import { formatBRL } from "@/lib/format";
import {
  customItemSchema,
  itemEditSchema,
  type CustomItemValues,
  type ItemEditValues,
} from "@/lib/quotes-schema";
import type { QuoteItemKind } from "@/types/database";
import { addCustomItem, removeQuoteItem, updateQuoteItem } from "../actions";

export interface ItemRow {
  id: string;
  kind: QuoteItemKind;
  description: string;
  quantity: number;
  unit_price_brl: number;
  suggested_unit_price_brl: number | null;
  subtotal_brl: number;
}

function PanelActions({
  pending,
  submitLabel,
  onCancel,
}: {
  pending: boolean;
  submitLabel: string;
  onCancel: () => void;
}) {
  return (
    <PanelFooter>
      <Button variant="secondary" onClick={onCancel} disabled={pending}>
        Cancelar
      </Button>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
        {submitLabel}
      </Button>
    </PanelFooter>
  );
}

function EditItemForm({ item, onClose }: { item: ItemRow; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ItemEditValues>({
    resolver: zodResolver(itemEditSchema),
    defaultValues: { description: item.description, unit_price_brl: item.unit_price_brl },
  });

  function onSubmit(values: ItemEditValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await updateQuoteItem(item.id, values);
      if (result.ok) onClose();
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
        <FormField id="edit-description" label="Descrição" error={errors.description?.message}>
          {(a) => (
            <Input
              {...register("description")}
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
          name="unit_price_brl"
          render={({ field, fieldState }) => (
            <FormField
              id="edit-price"
              label="Valor unitário final"
              help={
                item.kind === "custom"
                  ? undefined
                  : "Para mudar o cálculo, remova o item e adicione de novo."
              }
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
        {serverError && (
          <p role="alert" className="text-sm text-red-600">
            {serverError}
          </p>
        )}
      </PanelBody>
      <PanelActions pending={pending} submitLabel="Salvar item" onCancel={onClose} />
    </form>
  );
}

function CustomItemForm({ quoteId, onClose }: { quoteId: string; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomItemValues>({
    resolver: zodResolver(customItemSchema),
    defaultValues: { description: "", quantity: 1, unit_price_brl: 0 },
  });

  function onSubmit(values: CustomItemValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await addCustomItem(quoteId, values);
      if (result.ok) onClose();
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
        <FormField id="custom-description" label="Descrição" error={errors.description?.message}>
          {(a) => (
            <Input
              {...register("description")}
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
          name="quantity"
          render={({ field, fieldState }) => (
            <FormField id="custom-quantity" label="Quantidade" error={fieldState.error?.message}>
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
          name="unit_price_brl"
          render={({ field, fieldState }) => (
            <FormField id="custom-price" label="Valor unitário" error={fieldState.error?.message}>
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
        {serverError && (
          <p role="alert" className="text-sm text-red-600">
            {serverError}
          </p>
        )}
      </PanelBody>
      <PanelActions pending={pending} submitLabel="Adicionar item" onCancel={onClose} />
    </form>
  );
}

function ItemRowView({ item, onEdit }: { item: ItemRow; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await removeQuoteItem(item.id);
      if (!result.ok) {
        setError(result.message);
        setConfirming(false);
      }
    });
  }

  const differs =
    item.suggested_unit_price_brl !== null &&
    item.suggested_unit_price_brl !== item.unit_price_brl;

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{item.description}</p>
          <p className="text-sm text-tinta/70">
            {item.quantity} x {formatBRL(item.unit_price_brl)}
          </p>
          {differs && item.suggested_unit_price_brl !== null && (
            <p className="text-xs text-tinta/60">
              Sugerido pela calculadora: {formatBRL(item.suggested_unit_price_brl)}
            </p>
          )}
        </div>
        <p className="font-extrabold text-violeta">{formatBRL(item.subtotal_brl)}</p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" className="min-h-11" onClick={onEdit}>
          Editar
        </Button>
        {!confirming ? (
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11 text-red-700 hover:bg-red-50"
            onClick={() => setConfirming(true)}
          >
            Remover
          </Button>
        ) : (
          <>
            <Button variant="dark" size="sm" className="min-h-11" disabled={pending} onClick={remove}>
              Confirmar remoção
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Cancelar
            </Button>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </li>
  );
}

export function QuoteItems({
  quoteId,
  items,
  canAdd,
}: {
  quoteId: string;
  items: ItemRow[];
  canAdd: boolean;
}) {
  const [editing, setEditing] = useState<ItemRow | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div>
      {items.length === 0 ? (
        <p className="rounded-xl bg-nevoa p-4 text-sm text-tinta/70">
          Nenhum item ainda. Adicione um item avulso ou calcule nas calculadoras.
        </p>
      ) : (
        <ul className="divide-y divide-violeta/10">
          {items.map((item) => (
            <ItemRowView key={item.id} item={item} onEdit={() => setEditing(item)} />
          ))}
        </ul>
      )}

      {canAdd ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setAdding(true)}>
            <Plus size={16} aria-hidden="true" />
            Item avulso
          </Button>
          <Link href="/calculadora-fdm" className={buttonClasses({ variant: "secondary" })}>
            Calcular na Calculadora FDM
          </Link>
          <Link href="/calculadora-resina" className={buttonClasses({ variant: "secondary" })}>
            Calcular na Calculadora de Resina
          </Link>
          <p className="w-full text-xs text-tinta/60">
            Nas calculadoras, use &quot;Salvar em um orçamento&quot; e escolha este orçamento.
          </p>
        </div>
      ) : (
        <p className="mt-4 text-xs text-tinta/60">
          Só orçamentos em rascunho aceitam novos itens. Use &quot;Voltar para rascunho&quot; para
          adicionar.
        </p>
      )}

      <SidePanel open={editing !== null} onClose={() => setEditing(null)} title="Editar item">
        {editing && <EditItemForm key={editing.id} item={editing} onClose={() => setEditing(null)} />}
      </SidePanel>
      <SidePanel open={adding} onClose={() => setAdding(false)} title="Item avulso">
        <CustomItemForm quoteId={quoteId} onClose={() => setAdding(false)} />
      </SidePanel>
    </div>
  );
}
