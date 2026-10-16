"use client";

import { forwardRef, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Loader2 } from "lucide-react";
import { z } from "zod";
import { ModelPhoto } from "@/components/models/model-photo";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ConfirmSaveDialog } from "@/components/ui/confirm-save-dialog";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { IntegerInput } from "@/components/ui/integer-input";
import { cn } from "@/lib/utils";
import { PanelBody, PanelFooter } from "@/components/ui/side-panel";
import { Textarea } from "@/components/ui/textarea";
import { useConfirmSubmit } from "@/hooks/use-confirm-submit";
import { prepareModelPhoto } from "@/lib/image-resize";
import {
  formatPrintTime,
  MODEL_NOTES_MAX,
  modelFormSchema,
  splitMinutes,
  toTotalMinutes,
  type ModelCardData,
} from "@/lib/models-schema";
import { createModel, removeModelPhoto, updateModel, uploadModelPhoto } from "./actions";

// photo_note existe só para o resumo de alterações dizer que há uma foto nova. O servidor ignora.
const clientSchema = modelFormSchema.extend({ photo_note: z.string() });
type ClientInput = z.input<typeof clientSchema>;
type ClientValues = z.output<typeof clientSchema>;

interface PendingPhoto {
  blob: Blob;
  previewUrl: string;
}

function toDefaults(model: ModelCardData | null): ClientInput {
  const { hours, minutes } = splitMinutes(model?.printMinutes ?? null);
  return {
    name: model?.name ?? "",
    source_url: model?.sourceUrl ?? "",
    material_hint: model?.materialHint ?? "",
    weight_g: model?.weightG ?? null,
    hours,
    minutes,
    print_notes: model?.printNotes ?? "",
    photo_note: "",
  };
}

const weightFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

// Peso em gramas com até 2 casas decimais. Aceita vírgula ou ponto na digitação.
const WeightInput = forwardRef<
  HTMLInputElement,
  {
    id: string;
    name: string;
    value: number | null;
    onValueChange: (value: number | null) => void;
    onBlur: () => void;
    invalid?: boolean;
    "aria-describedby"?: string;
  }
>(({ value, onValueChange, onBlur, invalid, ...props }, ref) => {
  // Texto em edição: preserva o que a pessoa digitou (por exemplo, "12," antes do decimal).
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? "" : String(value).replace(".", ","));

  function handleChange(raw: string) {
    const text = raw.trim();
    if (!/^\d{0,6}([.,]\d{0,2})?$/.test(text)) return;
    setDraft(text);
    onValueChange(text === "" ? null : Number(text.replace(",", ".")));
  }

  return (
    <div className="relative">
      <input
        {...props}
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-invalid={invalid || undefined}
        value={shown}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => {
          setDraft(null);
          onBlur();
        }}
        className={cn(
          "min-h-11 w-full rounded-xl border bg-white px-4 pr-10 text-sm text-tinta shadow-sm outline-none transition placeholder:text-tinta/40 focus:border-violeta focus:ring-2 focus:ring-violeta/20",
          invalid ? "border-red-500" : "border-violeta/20",
        )}
      />
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-tinta/50">
        g
      </span>
    </div>
  );
});
WeightInput.displayName = "WeightInput";

async function sendPhoto(modelId: string, photo: PendingPhoto) {
  const data = new FormData();
  data.append("photo", photo.blob, "foto");
  return uploadModelPhoto(modelId, data);
}

export function ModelForm({
  model,
  isPro,
  onDone,
  onCancel,
}: {
  model: ModelCardData | null;
  isPro: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [photo, setPhoto] = useState<PendingPhoto | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  // Foto atual do modelo; zerada quando ela é removida aqui mesmo.
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(model?.photoUrl ?? null);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const form = useForm<ClientInput, unknown, ClientValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: toDefaults(model),
  });
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = form;

  // Libera a prévia anterior da memória.
  const previewUrl = photo?.previewUrl;
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const notes = useWatch({ control, name: "print_notes" }) ?? "";
  const hours = useWatch({ control, name: "hours" });
  const minutes = useWatch({ control, name: "minutes" });
  const totalTime = formatPrintTime(toTotalMinutes(hours ?? null, minutes ?? null));

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    setPhotoError(null);
    setPreparing(true);
    const result = await prepareModelPhoto(file);
    setPreparing(false);
    if (fileInput.current) fileInput.current.value = "";
    if (!result.ok) {
      setPhotoError(result.message);
      return;
    }
    setPhoto({ blob: result.blob, previewUrl: result.previewUrl });
    setValue("photo_note", "nova", { shouldDirty: true });
  }

  function discardPhoto() {
    setPhoto(null);
    setValue("photo_note", "", { shouldDirty: true });
  }

  // Na edição, salvar pede confirmação com o resumo do que muda.
  const confirmed = useConfirmSubmit({
    form,
    fields: [
      { name: "name", label: "Nome" },
      { name: "source_url", label: "Link de origem" },
      { name: "material_hint", label: "Material e cor" },
      { name: "weight_g", numeric: true, label: "Peso padrão", format: (v) => (v == null || v === "" ? "" : `${weightFormat.format(Number(v))} g`) },
      { name: "hours", numeric: true, label: "Horas de impressão", format: (v) => (v == null || v === "" ? "" : `${v} h`) },
      { name: "minutes", numeric: true, label: "Minutos de impressão", format: (v) => (v == null || v === "" ? "" : `${v} min`) },
      { name: "print_notes", label: "Observações de impressão" },
      { name: "photo_note", label: "Foto", format: (v) => (v ? "Nova foto" : "Sem alteração") },
    ],
    save: async (values) => {
      if (!model) return { ok: false, message: "Não foi possível salvar. Tente novamente." };
      const result = await updateModel(model.id, values);
      if (!result.ok) return result;
      if (photo) {
        const sent = await sendPhoto(model.id, photo);
        if (!sent.ok) return { ok: false, message: `Dados salvos, mas a foto não foi enviada. ${sent.message}` };
      }
    },
    onSaved: onDone,
  });

  // Criar não pede confirmação.
  function onCreate(values: ClientValues) {
    setServerError(null);
    setUpgrade(false);
    startTransition(async () => {
      const created = await createModel(values);
      if (!created.ok) {
        setServerError(created.message);
        setUpgrade(Boolean(created.upgrade));
        return;
      }
      if (photo) {
        const sent = await sendPhoto(created.id, photo);
        if (!sent.ok) {
          setServerError(`Modelo criado, mas a foto não foi enviada. ${sent.message} Edite o modelo para tentar de novo.`);
          return;
        }
      }
      onDone();
    });
  }

  const shownPhoto = photo?.previewUrl ?? currentPhoto;

  return (
    <form
      onSubmit={(e) => void handleSubmit(model ? confirmed.onSubmit : onCreate)(e)}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
    >
      <PanelBody>
        <FormField id="model-name" label="Nome" error={errors.name?.message}>
          {(a) => (
            <Input
              {...register("name")}
              id={a.id}
              maxLength={120}
              autoComplete="off"
              invalid={a.invalid}
              aria-describedby={a.describedBy}
              className="min-h-11"
            />
          )}
        </FormField>

        <section aria-labelledby="model-photo-title" data-tour="modelo-foto" className="space-y-2">
          <h3 id="model-photo-title" className="text-sm font-medium text-tinta">
            Foto (opcional)
          </h3>
          <ModelPhoto url={shownPhoto} name={model?.name || "Novo modelo"} className="w-full max-w-xs" />
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-label="Escolher foto do modelo"
            onChange={(e) => void onPickFile(e.target.files?.[0])}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="min-h-11"
              onClick={() => fileInput.current?.click()}
              disabled={preparing}
            >
              {preparing ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <ImagePlus size={16} aria-hidden="true" />
              )}
              {shownPhoto ? "Trocar foto" : "Escolher foto"}
            </Button>
            {photo && (
              <Button variant="ghost" size="sm" className="min-h-11" onClick={discardPhoto}>
                Descartar nova foto
              </Button>
            )}
            {model && currentPhoto && !photo && (
              <Button
                variant="ghost"
                size="sm"
                className="min-h-11 text-red-700 hover:bg-red-50"
                onClick={() => setRemovingPhoto(true)}
              >
                Remover foto
              </Button>
            )}
          </div>
          <p className="text-xs text-tinta/60">
            A foto é reduzida antes do envio. Aceitamos JPEG, PNG e WebP.
          </p>
          {photoError && (
            <p role="alert" className="text-xs text-red-600">
              {photoError}
            </p>
          )}
        </section>

        <FormField id="model-source" label="Link de origem (opcional)" error={errors.source_url?.message}>
          {(a) => (
            <Input
              {...register("source_url")}
              id={a.id}
              type="url"
              inputMode="url"
              maxLength={500}
              placeholder="https://"
              autoComplete="off"
              invalid={a.invalid}
              aria-describedby={a.describedBy}
              className="min-h-11"
            />
          )}
        </FormField>

        <FormField
          id="model-material"
          label="Material e cor usuais (opcional)"
          help="Por exemplo, PLA preto"
          error={errors.material_hint?.message}
        >
          {(a) => (
            <Input
              {...register("material_hint")}
              id={a.id}
              maxLength={80}
              autoComplete="off"
              invalid={a.invalid}
              aria-describedby={a.describedBy}
              className="min-h-11"
            />
          )}
        </FormField>

        <Controller
          control={control}
          name="weight_g"
          render={({ field, fieldState }) => (
            <FormField id="model-weight" label="Peso padrão em gramas (opcional)" error={fieldState.error?.message}>
              {(a) => (
                <WeightInput
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

        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-sm font-medium text-tinta">Tempo de impressão padrão (opcional)</legend>
          <div className="grid grid-cols-2 gap-3">
            <Controller
              control={control}
              name="hours"
              render={({ field, fieldState }) => (
                <FormField id="model-hours" label="Horas" error={fieldState.error?.message}>
                  {(a) => (
                    <IntegerInput
                      ref={field.ref}
                      id={a.id}
                      name={field.name}
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      suffix="h"
                      maxDigits={3}
                      invalid={a.invalid}
                      aria-describedby={a.describedBy}
                    />
                  )}
                </FormField>
              )}
            />
            <Controller
              control={control}
              name="minutes"
              render={({ field, fieldState }) => (
                <FormField id="model-minutes" label="Minutos" error={fieldState.error?.message}>
                  {(a) => (
                    <IntegerInput
                      ref={field.ref}
                      id={a.id}
                      name={field.name}
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      suffix="min"
                      maxDigits={2}
                      invalid={a.invalid}
                      aria-describedby={a.describedBy}
                    />
                  )}
                </FormField>
              )}
            />
          </div>
          {totalTime && (
            <p className="text-xs text-tinta/60" aria-live="polite">
              Total: {totalTime}
            </p>
          )}
        </fieldset>

        <FormField
          id="model-notes"
          label="Observações de impressão (opcional)"
          help="Suportes, orientação, velocidade, pós-processamento"
          error={errors.print_notes?.message}
        >
          {(a) => (
            <>
              <Textarea
                {...register("print_notes")}
                id={a.id}
                maxLength={MODEL_NOTES_MAX}
                invalid={a.invalid}
                aria-describedby={a.describedBy}
                className="min-h-32"
              />
              <p className="mt-1 text-right text-xs text-tinta/60" aria-live="polite">
                {notes.length} de {MODEL_NOTES_MAX}
              </p>
            </>
          )}
        </FormField>

        {confirmed.notice && (
          <p role="status" className="text-sm font-medium text-tinta/70">
            {confirmed.notice}
          </p>
        )}
        {serverError && (
          <div role="alert" className="space-y-2 text-sm text-red-600">
            <p>{serverError}</p>
            {upgrade && isPro && (
              <Link href="/assinatura" className={buttonClasses({ variant: "secondary" })}>
                Ver o plano Loja
              </Link>
            )}
          </div>
        )}
      </PanelBody>
      <PanelFooter>
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending || preparing}>
          {pending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          Salvar
        </Button>
      </PanelFooter>
      <ConfirmSaveDialog {...confirmed.dialog} />
      {model && (
        <ConfirmDialog
          open={removingPhoto}
          onOpenChange={setRemovingPhoto}
          title="Remover a foto?"
          description={`A foto do modelo "${model.name}" será apagada. Você pode enviar outra depois.`}
          confirmLabel="Remover foto"
          variant="danger"
          onConfirm={async () => {
            const result = await removeModelPhoto(model.id);
            if (!result.ok) return result;
            setCurrentPhoto(null);
          }}
        />
      )}
    </form>
  );
}
