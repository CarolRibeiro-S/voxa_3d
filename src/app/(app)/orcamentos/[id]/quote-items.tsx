"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { ModelPicker } from "@/components/models/model-picker";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ConfirmSaveDialog } from "@/components/ui/confirm-save-dialog";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { IntegerInput } from "@/components/ui/integer-input";
import { MoneyInput } from "@/components/ui/money-input";
import { PanelBody, PanelFooter, SidePanel } from "@/components/ui/side-panel";
import { useConfirmSubmit } from "@/hooks/use-confirm-submit";
import { formatBRL } from "@/lib/format";
import type { ModelOption } from "@/lib/models-schema";
import {
  customItemSchema,
  isQuoteLocked,
  itemEditSchema,
  type CustomItemValues,
  type ItemEditValues,
} from "@/lib/quotes-schema";
import type { QuoteItemKind, QuoteStatus } from "@/types/database";
import { addCustomItem, removeQuoteItem, updateQuoteItem } from "../actions";

export interface ItemRow {
  id: string;
  kind: QuoteItemKind;
  description: string;
  quantity: number;
  unit_price_brl: number;
  suggested_unit_price_brl: number | null;
  subtotal_brl: number;
  // Nome do modelo do item, quando houver (só aparece para quem gerencia orçamentos).
  model_name: string | null;
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
  const form = useForm<ItemEditValues>({
    resolver: zodResolver(itemEditSchema),
    defaultValues: { description: item.description, unit_price_brl: item.unit_price_brl },
  });
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = form;

  // Salvar pede confirmação com o resumo do que muda (o diálogo abre por cima do painel).
  const confirmed = useConfirmSubmit({
    form,
    fields: [
      { name: "description", label: "Descrição" },
      {
        name: "unit_price_brl", numeric: true,
        label: "Valor unitário final",
        format: (v) => formatBRL(Number(v ?? 0)),
      },
    ],
    save: (values) => updateQuoteItem(item.id, values),
    onSaved: onClose,
  });

  return (
    <form
      onSubmit={(e) => void handleSubmit(confirmed.onSubmit)(e)}
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
        {confirmed.notice && (
          <p role="status" className="text-sm font-medium text-tinta/70">
            {confirmed.notice}
          </p>
        )}
      </PanelBody>
      <PanelActions pending={false} submitLabel="Salvar item" onCancel={onClose} />
      <ConfirmSaveDialog {...confirmed.dialog} />
    </form>
  );
}

function CustomItemForm({ quoteId, onClose }: { quoteId: string; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [model, setModel] = useState<ModelOption | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<CustomItemValues>({
    resolver: zodResolver(customItemSchema),
    defaultValues: { description: "", quantity: 1, unit_price_brl: 0 },
  });

  function onSubmit(values: CustomItemValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await addCustomItem(quoteId, values, model?.id ?? null);
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
        <ModelPicker
          id="custom-model"
          value={model}
          onChange={(option) => {
            setModel(option);
            // Descrição vazia: usa o nome do modelo.
            if (option && getValues("description").trim() === "") {
              setValue("description", option.name.slice(0, 120), { shouldValidate: true });
            }
          }}
        />
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

function ItemRowView({
  item,
  locked,
  onEdit,
}: {
  item: ItemRow;
  locked: boolean;
  onEdit: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

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
          {item.model_name && <p className="text-xs text-tinta/60">Modelo: {item.model_name}</p>}
          {differs && item.suggested_unit_price_brl !== null && (
            <p className="text-xs text-tinta/60">
              Sugerido pela calculadora: {formatBRL(item.suggested_unit_price_brl)}
            </p>
          )}
        </div>
        <p className="font-extrabold text-violeta">{formatBRL(item.subtotal_brl)}</p>
      </div>
      {!locked && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" className="min-h-11" onClick={onEdit}>
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11 text-red-700 hover:bg-red-50"
            onClick={() => setConfirming(true)}
          >
            Remover
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Remover este item?"
        description={`O item "${item.description}" irá para a Lixeira e pode ser restaurado em Histórico.`}
        confirmLabel="Remover item"
        variant="danger"
        onConfirm={() => removeQuoteItem(item.id)}
      />
    </li>
  );
}

export function QuoteItems({
  quoteId,
  items,
  status,
}: {
  quoteId: string;
  items: ItemRow[];
  status: QuoteStatus;
}) {
  const locked = isQuoteLocked(status);
  const canAdd = status === "draft";
  const [editing, setEditing] = useState<ItemRow | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div>
      {items.length === 0 ? (
        <p className="rounded-xl bg-nevoa p-4 text-sm text-tinta/70">
          {locked
            ? "Este orçamento não tem itens."
            : "Nenhum item ainda. Adicione um item avulso ou calcule nas calculadoras."}
        </p>
      ) : (
        <ul className="divide-y divide-violeta/10">
          {items.map((item) => (
            <ItemRowView key={item.id} item={item} locked={locked} onEdit={() => setEditing(item)} />
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
        !locked && (
          <p className="mt-4 text-xs text-tinta/60">
            Novos itens só podem ser adicionados em rascunho. Use &quot;Voltar para rascunho&quot;
            para adicionar.
          </p>
        )
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
