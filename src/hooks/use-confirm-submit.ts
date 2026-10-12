"use client";

import { useEffect, useState } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import type { ConfirmResult } from "@/components/ui/confirm-dialog";
import type { ChangeItem } from "@/components/ui/changes-summary";

export const NO_CHANGES_NOTICE = "Nenhuma alteração para salvar";

export interface ChangeField<T extends FieldValues> {
  name: keyof T & string;
  label: string;
  // Formata o valor como o formulário o mostra (BRL, percentual, status traduzido).
  format?: (value: unknown) => string;
  sensitive?: boolean;
}

// Compara ignorando espaços nas pontas e tratando vazio, null e undefined como iguais.
function normalize(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function defaultFormat(value: unknown): string {
  return normalize(value);
}

interface UseConfirmSubmitOptions<TInput extends FieldValues, TOutput> {
  form: UseFormReturn<TInput, unknown, TOutput>;
  fields: ChangeField<TInput>[];
  // Roda só depois da confirmação. Devolve { ok: false, message } para mostrar o erro no diálogo.
  save: (values: TOutput) => Promise<ConfirmResult>;
  onSaved?: (values: TOutput) => void;
}

// Para formulários que EDITAM dados existentes: ao enviar (já validado), se nada mudou mostra
// um aviso. Se algo mudou, abre a confirmação com o resumo dos campos alterados. A lista vem
// só dos valores que a pessoa vê e digitou no formulário.
export function useConfirmSubmit<TInput extends FieldValues, TOutput>({
  form,
  fields,
  save,
  onSaved,
}: UseConfirmSubmitOptions<TInput, TOutput>) {
  const [baseline, setBaseline] = useState<TInput>(() => form.getValues());
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingValues, setPendingValues] = useState<TOutput | null>(null);
  const [changes, setChanges] = useState<ChangeItem[]>([]);
  const [open, setOpen] = useState(false);

  // O aviso some assim que a pessoa mexe em qualquer campo.
  useEffect(() => {
    const subscription = form.watch(() => setNotice(null));
    return () => subscription.unsubscribe();
  }, [form]);

  function onSubmit(values: TOutput) {
    const current = form.getValues();
    const list: ChangeItem[] = [];
    for (const field of fields) {
      if (normalize(baseline[field.name]) === normalize(current[field.name])) continue;
      const format = field.format ?? defaultFormat;
      list.push({
        label: field.label,
        // Campos sensíveis nunca levam o valor adiante.
        from: field.sensitive ? "" : format(baseline[field.name]),
        to: field.sensitive ? "" : format(current[field.name]),
        sensitive: field.sensitive,
      });
    }

    if (list.length === 0) {
      setNotice(NO_CHANGES_NOTICE);
      return;
    }
    setNotice(null);
    setChanges(list);
    setPendingValues(values);
    setOpen(true);
  }

  async function onConfirm(): Promise<ConfirmResult> {
    if (pendingValues === null) return { ok: false, message: "Nada para salvar." };
    const result = await save(pendingValues);
    if (result && !result.ok) return result;
    // O que foi salvo vira o novo ponto de partida.
    setBaseline(form.getValues());
    onSaved?.(pendingValues);
  }

  return {
    onSubmit,
    notice,
    dialog: { open, onOpenChange: setOpen, changes, onConfirm },
  };
}
