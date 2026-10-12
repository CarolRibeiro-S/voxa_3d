"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ConfirmSaveDialog } from "@/components/ui/confirm-save-dialog";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PanelBody, PanelFooter, SidePanel } from "@/components/ui/side-panel";
import { useConfirmSubmit } from "@/hooks/use-confirm-submit";
import { formatBRL, formatPercent } from "@/lib/format";
import {
  CHANNEL_PRESETS,
  decimalToText,
  parseDecimal,
  salesChannelSchema,
  type SalesChannelInput,
  type SalesChannelValues,
} from "@/lib/sales-channels-schema";
import { cn } from "@/lib/utils";
import type { SalesChannel } from "@/types/database";
import {
  createSalesChannel,
  deleteSalesChannel,
  setSalesChannelActive,
  updateSalesChannel,
} from "./channels-actions";

interface ChannelDefaults {
  payment_pct: number;
  tax_pct: number;
}

const HELP_RATES =
  "Confira na central do vendedor do canal. Se a taxa muda por faixa de preço, cadastre uma entrada para cada faixa (ex.: Shopee faixa 1, Shopee faixa 2).";

// Texto de um percentual digitado ("4,5") para mostrar no resumo.
const pctText = (v: unknown) => {
  const n = parseDecimal(String(v ?? ""));
  return n === null ? "" : `${formatPercent(n)}%`;
};
const brlText = (v: unknown) => {
  const n = parseDecimal(String(v ?? ""));
  return n === null ? "" : formatBRL(n);
};

type DecimalName = "commission_pct" | "fixed_fee_brl" | "payment_pct" | "tax_pct";

function DecimalField({
  name,
  control,
  label,
  help,
  prefix,
  suffix,
  setValue,
}: {
  name: DecimalName;
  control: ReturnType<typeof useForm<SalesChannelInput, unknown, SalesChannelValues>>["control"];
  label: string;
  help?: string;
  prefix?: string;
  suffix?: string;
  setValue: (name: DecimalName, value: string) => void;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormField id={`channel-${name}`} label={label} help={help} error={fieldState.error?.message}>
          {(a) => (
            <div className="relative">
              {prefix && (
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm font-medium text-tinta/50">
                  {prefix}
                </span>
              )}
              <Input
                ref={field.ref}
                id={a.id}
                name={field.name}
                inputMode="decimal"
                autoComplete="off"
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={() => {
                  // Ao sair do campo, um número válido ganha as duas casas.
                  const n = parseDecimal(field.value ?? "");
                  if (n !== null) setValue(name, decimalToText(n));
                  field.onBlur();
                }}
                invalid={a.invalid}
                aria-describedby={a.describedBy}
                className={cn("min-h-11", prefix && "pl-11", suffix && "pr-10")}
              />
              {suffix && (
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-tinta/50">
                  {suffix}
                </span>
              )}
            </div>
          )}
        </FormField>
      )}
    />
  );
}

function ChannelForm({
  channel,
  defaults,
  onClose,
}: {
  channel: SalesChannel | null;
  defaults: ChannelDefaults;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  // Comissão e taxa fixa começam vazias: nenhum canal vem com taxa pré-preenchida.
  const form = useForm<SalesChannelInput, unknown, SalesChannelValues>({
    resolver: zodResolver(salesChannelSchema),
    defaultValues: channel
      ? {
          name: channel.name,
          commission_pct: decimalToText(channel.commission_pct),
          fixed_fee_brl: decimalToText(channel.fixed_fee_brl),
          payment_pct: decimalToText(channel.payment_pct),
          tax_pct: decimalToText(channel.tax_pct),
        }
      : {
          name: "",
          commission_pct: "",
          fixed_fee_brl: "",
          payment_pct: decimalToText(defaults.payment_pct),
          tax_pct: decimalToText(defaults.tax_pct),
        },
  });
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = form;

  // Editar pede confirmação com o resumo do que muda. Criar não.
  const confirmed = useConfirmSubmit({
    form,
    fields: [
      { name: "name", label: "Nome" },
      { name: "commission_pct", label: "Comissão do canal", format: pctText },
      { name: "fixed_fee_brl", label: "Taxa fixa por venda", format: brlText },
      { name: "payment_pct", label: "Taxa de pagamento", format: pctText },
      { name: "tax_pct", label: "Imposto", format: pctText },
    ],
    // O servidor valida o texto digitado de novo, por isso vai o valor cru do formulário.
    save: () =>
      channel ? updateSalesChannel(channel.id, form.getValues()) : createSalesChannel(form.getValues()),
    onSaved: onClose,
  });

  function onSubmit(values: SalesChannelValues) {
    if (channel) {
      confirmed.onSubmit(values);
      return;
    }
    setServerError(null);
    startTransition(async () => {
      const result = await createSalesChannel(form.getValues());
      if (result.ok) onClose();
      else setServerError(result.message);
    });
  }

  const setText = (name: DecimalName | "name", value: string) =>
    setValue(name, value, { shouldDirty: true, shouldValidate: true });

  return (
    <form
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
    >
      <PanelBody>
        <FormField id="channel-name" label="Nome do canal" error={errors.name?.message}>
          {(a) => (
            <>
              <Input
                {...register("name")}
                id={a.id}
                maxLength={40}
                autoComplete="off"
                invalid={a.invalid}
                aria-describedby={a.describedBy}
                className="min-h-11"
              />
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Atalhos de nome">
                {CHANNEL_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setText("name", preset)}
                    className="min-h-11 rounded-xl border border-violeta/20 bg-white px-3 text-xs font-semibold hover:bg-nevoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </>
          )}
        </FormField>

        <DecimalField
          name="commission_pct"
          control={control}
          label="Comissão do canal (%)"
          suffix="%"
          setValue={setText}
        />
        <DecimalField
          name="fixed_fee_brl"
          control={control}
          label="Taxa fixa por venda (R$)"
          prefix="R$"
          setValue={setText}
        />
        <p className="text-xs text-tinta/60">{HELP_RATES}</p>
        <DecimalField
          name="payment_pct"
          control={control}
          label="Taxa de pagamento (%)"
          suffix="%"
          setValue={setText}
        />
        <DecimalField
          name="tax_pct"
          control={control}
          label="Imposto (%)"
          suffix="%"
          setValue={setText}
        />

        {confirmed.notice && (
          <p role="status" className="text-sm font-medium text-tinta/70">
            {confirmed.notice}
          </p>
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
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {channel ? "Salvar" : "Adicionar canal"}
        </Button>
      </PanelFooter>
      <ConfirmSaveDialog {...confirmed.dialog} />
    </form>
  );
}

type Pending = "deactivate" | "reactivate" | "delete" | null;

function ChannelActions({ channel, onEdit }: { channel: SalesChannel; onEdit: () => void }) {
  const [action, setAction] = useState<Pending>(null);
  const texts = {
    deactivate: {
      title: "Desativar canal?",
      description: `O canal ${channel.name} deixa de aparecer na tabela de preço das calculadoras.`,
      confirmLabel: "Desativar canal",
    },
    reactivate: {
      title: "Reativar canal?",
      description: `O canal ${channel.name} volta a aparecer na tabela de preço das calculadoras.`,
      confirmLabel: "Reativar canal",
    },
    delete: {
      title: "Excluir canal?",
      description: `O canal ${channel.name} irá para a Lixeira e pode ser restaurado em Histórico.`,
      confirmLabel: "Excluir canal",
    },
  } as const;
  const text = action ? texts[action] : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" className="min-h-11" onClick={onEdit}>
        Editar
      </Button>
      {channel.is_active ? (
        <Button variant="ghost" size="sm" className="min-h-11" onClick={() => setAction("deactivate")}>
          Desativar
        </Button>
      ) : (
        <Button variant="ghost" size="sm" className="min-h-11" onClick={() => setAction("reactivate")}>
          Reativar
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="min-h-11 text-red-700 hover:bg-red-50"
        onClick={() => setAction("delete")}
      >
        Excluir
      </Button>
      <ConfirmDialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open) setAction(null);
        }}
        title={text?.title ?? ""}
        description={text?.description ?? ""}
        confirmLabel={text?.confirmLabel ?? "Confirmar"}
        variant={action === "reactivate" ? "default" : "danger"}
        onConfirm={() =>
          action === "delete"
            ? deleteSalesChannel(channel.id)
            : setSalesChannelActive(channel.id, action === "reactivate")
        }
      />
    </div>
  );
}

type Editing = { channel: SalesChannel | null } | null;

export function SalesChannelsCard({
  channels,
  defaults,
  locked,
}: {
  channels: SalesChannel[];
  defaults: ChannelDefaults;
  locked: boolean;
}) {
  const [editing, setEditing] = useState<Editing>(null);

  if (locked) {
    return (
      <Card className="opacity-80">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <Lock size={18} aria-hidden="true" />
          Canais de venda
        </h2>
        <p className="mt-2 text-sm text-tinta/70">Disponível nos planos Pro e Loja</p>
      </Card>
    );
  }

  const statusBadge = (c: SalesChannel) =>
    c.is_active ? <Badge variant="success">Ativo</Badge> : <Badge>Inativo</Badge>;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">Canais de venda</h2>
          <p className="mt-1 text-sm text-tinta/70">
            Cadastre onde você vende. A calculadora mostra o preço sugerido em cada canal, já com a
            comissão e as taxas dele.
          </p>
        </div>
        {channels.length > 0 && (
          <Button onClick={() => setEditing({ channel: null })}>
            <Plus size={16} aria-hidden="true" />
            Adicionar canal
          </Button>
        )}
      </div>

      {channels.length === 0 ? (
        <div className="mt-6 rounded-xl bg-nevoa p-6 text-center">
          <p className="font-semibold">Nenhum canal cadastrado ainda</p>
          <Button className="mt-4" onClick={() => setEditing({ channel: null })}>
            <Plus size={16} aria-hidden="true" />
            Adicionar canal
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-6 hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Canais de venda cadastrados</caption>
              <thead className="bg-nevoa text-xs uppercase tracking-wide text-tinta/60">
                <tr>
                  <th scope="col" className="px-4 py-3">Canal</th>
                  <th scope="col" className="px-4 py-3">Comissão</th>
                  <th scope="col" className="px-4 py-3">Taxa fixa</th>
                  <th scope="col" className="px-4 py-3">Pagamento</th>
                  <th scope="col" className="px-4 py-3">Imposto</th>
                  <th scope="col" className="px-4 py-3">Situação</th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-violeta/10">
                {channels.map((c) => (
                  <tr key={c.id} className={cn(!c.is_active && "opacity-70")}>
                    <th scope="row" className="px-4 py-3 font-semibold">{c.name}</th>
                    <td className="px-4 py-3">{formatPercent(c.commission_pct)}%</td>
                    <td className="px-4 py-3">{formatBRL(c.fixed_fee_brl)}</td>
                    <td className="px-4 py-3">{formatPercent(c.payment_pct)}%</td>
                    <td className="px-4 py-3">{formatPercent(c.tax_pct)}%</td>
                    <td className="px-4 py-3">{statusBadge(c)}</td>
                    <td className="px-4 py-3">
                      <ChannelActions channel={c} onEdit={() => setEditing({ channel: c })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-6 space-y-3 md:hidden">
            {channels.map((c) => (
              <li
                key={c.id}
                className={cn(
                  "rounded-xl border border-violeta/10 p-4 shadow-sm",
                  !c.is_active && "opacity-70",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{c.name}</p>
                  {statusBadge(c)}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-tinta/60">Comissão</dt>
                    <dd>{formatPercent(c.commission_pct)}%</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-tinta/60">Taxa fixa por venda</dt>
                    <dd>{formatBRL(c.fixed_fee_brl)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-tinta/60">Pagamento</dt>
                    <dd>{formatPercent(c.payment_pct)}%</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-tinta/60">Imposto</dt>
                    <dd>{formatPercent(c.tax_pct)}%</dd>
                  </div>
                </dl>
                <div className="mt-3">
                  <ChannelActions channel={c} onEdit={() => setEditing({ channel: c })} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <SidePanel
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.channel ? "Editar canal" : "Adicionar canal"}
      >
        {editing && (
          <ChannelForm
            channel={editing.channel}
            defaults={defaults}
            onClose={() => setEditing(null)}
          />
        )}
      </SidePanel>
    </Card>
  );
}
