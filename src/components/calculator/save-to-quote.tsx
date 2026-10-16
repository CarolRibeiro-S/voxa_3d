"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FilePlus2, Loader2 } from "lucide-react";
import {
  addQuoteItemFromCalculation,
  listDraftQuotes,
  type DraftQuoteOption,
} from "@/app/(app)/orcamentos/actions";
import { SELECT_CLASS } from "@/components/calculator/calc-fields";
import { ModelPicker } from "@/components/models/model-picker";
import { Button, buttonClasses } from "@/components/ui/button";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { PanelBody, PanelFooter, SidePanel } from "@/components/ui/side-panel";
import type { FdmCalcInput } from "@/lib/fdm-calc-schema";
import type { ModelOption } from "@/lib/models-schema";
import { formatQuoteNumber, saveToQuoteFormSchema, type SaveToQuoteFormValues } from "@/lib/quotes-schema";
import type { ResinCalcInput } from "@/lib/resin-calc-schema";
import { cn } from "@/lib/utils";

type SaveToQuoteProps =
  | { kind: "fdm"; input: FdmCalcInput }
  | { kind: "resin"; input: ResinCalcInput };

type Props = SaveToQuoteProps & {
  suggestedPrice: number;
  disabled: boolean;
};

type Saved = { quoteId: string; number: number };

function SaveForm({
  kind,
  input,
  suggestedPrice,
  onClose,
}: SaveToQuoteProps & { suggestedPrice: number; onClose: () => void }) {
  const [drafts, setDrafts] = useState<DraftQuoteOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [model, setModel] = useState<ModelOption | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<SaveToQuoteFormValues>({
    resolver: zodResolver(saveToQuoteFormSchema),
    defaultValues: {
      target: "",
      customer_name: "",
      description: "",
      unit_price_brl: suggestedPrice,
    },
  });

  // A lista de rascunhos só é carregada quando o painel abre.
  useEffect(() => {
    let active = true;
    listDraftQuotes().then((result) => {
      if (!active) return;
      if (result.ok) {
        setDrafts(result.quotes);
        setValue("target", result.quotes.length === 0 ? "new" : "");
      } else {
        setLoadError(result.message);
        setDrafts([]);
        setValue("target", "new");
      }
    });
    return () => {
      active = false;
    };
  }, [setValue]);

  const target = useWatch({ control, name: "target" });

  function onSubmit(values: SaveToQuoteFormValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await addQuoteItemFromCalculation(
        kind,
        input,
        values.target === "new"
          ? { type: "new", customer_name: values.customer_name }
          : { type: "existing", quote_id: values.target },
        values.description,
        values.unit_price_brl,
        model?.id ?? null,
      );
      if (result.ok) setSaved({ quoteId: result.quoteId, number: result.number });
      else setServerError(result.message);
    });
  }

  if (saved) {
    return (
      <>
        <PanelBody>
          <p role="status" className="rounded-xl bg-green-50 p-4 text-sm font-medium text-green-800">
            Item salvo no orçamento nº {formatQuoteNumber(saved.number)}.
          </p>
        </PanelBody>
        <PanelFooter>
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
          <Link href={`/orcamentos/${saved.quoteId}`} className={buttonClasses({})}>
            Abrir orçamento
          </Link>
        </PanelFooter>
      </>
    );
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
    >
      <PanelBody>
        {drafts === null ? (
          <p role="status" className="text-sm text-tinta/60">
            Carregando orçamentos...
          </p>
        ) : (
          <>
            <FormField id="save-target" label="Orçamento" error={errors.target?.message}>
              {(a) => (
                <select
                  {...register("target")}
                  id={a.id}
                  aria-invalid={a.invalid || undefined}
                  aria-describedby={a.describedBy}
                  className={cn(SELECT_CLASS, a.invalid ? "border-red-500" : "border-violeta/20")}
                >
                  <option value="">Selecione um rascunho</option>
                  {drafts.map((q) => (
                    <option key={q.id} value={q.id}>
                      {formatQuoteNumber(q.number)} · {q.customer_name}
                    </option>
                  ))}
                  <option value="new">Novo orçamento</option>
                </select>
              )}
            </FormField>
            {loadError && (
              <p role="alert" className="text-xs text-red-600">
                {loadError}
              </p>
            )}

            {target === "new" && (
              <FormField
                id="save-customer"
                label="Nome do cliente"
                error={errors.customer_name?.message}
              >
                {(a) => (
                  <Input
                    {...register("customer_name")}
                    id={a.id}
                    maxLength={120}
                    autoComplete="off"
                    invalid={a.invalid}
                    aria-describedby={a.describedBy}
                  />
                )}
              </FormField>
            )}

            <FormField
              id="save-description"
              label="Descrição do item"
              help="Ex.: Suporte de headset"
              error={errors.description?.message}
            >
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
              id="save-model"
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
              name="unit_price_brl"
              render={({ field, fieldState }) => (
                <FormField
                  id="save-price"
                  label="Valor unitário final"
                  help="Começa com o preço sugerido. Você pode ajustar."
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
          </>
        )}
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
        <Button type="submit" disabled={pending || drafts === null}>
          {pending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          Salvar item
        </Button>
      </PanelFooter>
    </form>
  );
}

// Botão e painel "Salvar em um orçamento". O preço é recalculado no servidor ao salvar.
export function SaveToQuote(props: Props) {
  const [open, setOpen] = useState(false);
  const { suggestedPrice, disabled } = props;

  return (
    <div>
      <Button
        variant="secondary"
        className="w-full"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-describedby={disabled ? "save-quote-hint" : undefined}
      >
        <FilePlus2 size={16} aria-hidden="true" />
        Salvar em um orçamento
      </Button>
      {disabled && (
        <p id="save-quote-hint" className="mt-1 text-xs text-tinta/60">
          Calcule de novo para salvar.
        </p>
      )}
      <SidePanel open={open} onClose={() => setOpen(false)} title="Salvar em um orçamento">
        {props.kind === "fdm" ? (
          <SaveForm
            kind="fdm"
            input={props.input}
            suggestedPrice={suggestedPrice}
            onClose={() => setOpen(false)}
          />
        ) : (
          <SaveForm
            kind="resin"
            input={props.input}
            suggestedPrice={suggestedPrice}
            onClose={() => setOpen(false)}
          />
        )}
      </SidePanel>
    </div>
  );
}
