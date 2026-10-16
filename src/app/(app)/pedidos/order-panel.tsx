"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { ConfirmSaveDialog } from "@/components/ui/confirm-save-dialog";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PanelBody, PanelFooter, SidePanel } from "@/components/ui/side-panel";
import { Textarea } from "@/components/ui/textarea";
import { useConfirmSubmit } from "@/hooks/use-confirm-submit";
import type { ActivityEntry } from "@/lib/audit";
import { formatBRL, formatDate, formatDateTime, formatPhone, normalizePhoneDigits } from "@/lib/format";
import {
  editOrderSchema,
  isOrderLocked,
  ORDER_KIND_LABEL,
  type EditOrderInput,
  type EditOrderValues,
} from "@/lib/orders";
import type { OrderStatus } from "@/types/database";
import type { BoardOrder } from "./orders-board";
import { listOrderActivity, updateOrder } from "./actions";
import { ItemModel } from "./item-model";
import { NotifyButton } from "./notify-button";
import { OrderNav, PaymentButton } from "./order-nav";
import { DueBadge, OrderStatusBadge } from "./order-ui";

interface OrderPanelProps {
  restricted: boolean;
  canSetModel: boolean;
  canOpenModels: boolean;
  order: BoardOrder | null;
  onClose: () => void;
  // As confirmações (mudar de etapa, pagamento e exclusão) abrem no quadro.
  onMove: (order: BoardOrder, to: OrderStatus) => void;
  onPay: (order: BoardOrder) => void;
  onDelete: (order: BoardOrder) => void;
}

function EditForm({
  order,
  focusPhone,
  onDone,
}: {
  order: BoardOrder;
  focusPhone: boolean;
  onDone: () => void;
}) {
  const isClient = order.kind === "client";
  const showTracking = isClient && order.status === "shipped";

  const form = useForm<EditOrderInput, unknown, EditOrderValues>({
    resolver: zodResolver(editOrderSchema),
    defaultValues: {
      client_name: order.customerName ?? "",
      client_phone: order.customerPhone ?? "",
      due_date: order.dueDate ?? "",
      tracking_code: order.trackingCode ?? "",
      notes: order.notes ?? "",
    },
  });
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = form;

  // Atalho de "Cadastrar telefone": leva o foco direto para o campo de telefone.
  useEffect(() => {
    if (focusPhone) document.getElementById("edit-phone")?.focus();
  }, [focusPhone]);

  // Salvar pede confirmação com o resumo do que muda.
  const confirmed = useConfirmSubmit({
    form,
    fields: [
      ...(isClient
        ? [
            { name: "client_name" as const, label: "Cliente" },
            {
              name: "client_phone" as const,
              label: "Telefone",
              format: (v: unknown) => formatPhone(String(v ?? "")),
            },
          ]
        : []),
      {
        name: "due_date",
        label: "Prazo de entrega",
        format: (v) => (v ? formatDate(String(v)) : ""),
      },
      ...(showTracking ? [{ name: "tracking_code" as const, label: "Código de rastreio" }] : []),
      { name: "notes", label: "Observações" },
    ],
    // O servidor valida o texto digitado de novo, por isso vai o valor cru do formulário.
    save: () => updateOrder(order.id, form.getValues()),
    onSaved: onDone,
  });

  return (
    <form
      onSubmit={(e) => void handleSubmit(confirmed.onSubmit)(e)}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
    >
      <PanelBody>
        {isClient && (
          <>
            <FormField id="edit-customer" label="Nome do cliente" error={errors.client_name?.message}>
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
                <FormField id="edit-phone" label="Telefone" error={fieldState.error?.message}>
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
        <FormField id="edit-due" label="Prazo de entrega" error={errors.due_date?.message}>
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
        {showTracking && (
          <FormField id="edit-tracking" label="Código de rastreio" error={errors.tracking_code?.message}>
            {(a) => (
              <Input
                {...register("tracking_code")}
                id={a.id}
                maxLength={60}
                autoComplete="off"
                invalid={a.invalid}
                aria-describedby={a.describedBy}
              />
            )}
          </FormField>
        )}
        <FormField id="edit-notes" label="Observações" error={errors.notes?.message}>
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
        {confirmed.notice && (
          <p role="status" className="text-sm font-medium text-tinta/70">
            {confirmed.notice}
          </p>
        )}
      </PanelBody>
      <PanelFooter>
        <Button variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit">Salvar</Button>
      </PanelFooter>
      <ConfirmSaveDialog {...confirmed.dialog} />
    </form>
  );
}

function History({ orderId }: { orderId: string }) {
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listOrderActivity(orderId).then((result) => {
      if (!active) return;
      if (result.ok) setEntries(result.entries);
      else setError(result.message);
    });
    return () => {
      active = false;
    };
  }, [orderId]);

  return (
    <section aria-labelledby="order-history">
      <h3 id="order-history" className="text-sm font-bold uppercase tracking-wide text-violeta-escuro">
        Histórico do pedido
      </h3>
      {error ? (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      ) : entries === null ? (
        <p className="mt-2 text-sm text-tinta/60">Carregando...</p>
      ) : entries.length === 0 ? (
        <p className="mt-2 text-sm text-tinta/60">Nenhuma atividade registrada ainda.</p>
      ) : (
        <ul className="mt-2 space-y-3 text-sm">
          {entries.map((entry) => (
            <li key={entry.id}>
              <p className="font-medium">{entry.phrase}</p>
              <p className="text-xs text-tinta/60">
                {formatDateTime(entry.at)} | por {entry.actor}
              </p>
              {entry.fields.map((f) => (
                <p key={f.label} className="text-xs text-tinta/80">
                  {f.label}: {f.from} para {f.to}
                </p>
              ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Details({
  restricted,
  canSetModel,
  canOpenModels,
  order,
  onEdit,
  onMove,
  onPay,
  onDelete,
  onClose,
}: {
  restricted: boolean;
  canSetModel: boolean;
  canOpenModels: boolean;
  order: BoardOrder;
  onEdit: (focusPhone: boolean) => void;
  onMove: (order: BoardOrder, to: OrderStatus) => void;
  onPay: (order: BoardOrder) => void;
  onDelete: (order: BoardOrder) => void;
  onClose: () => void;
}) {
  const locked = isOrderLocked(order.status);
  const isClient = order.kind === "client";

  return (
    <>
      <PanelBody>
        {/* Pagamento em destaque, com o mesmo botão e a mesma confirmação do cartão. */}
        {isClient && !restricted && (
          <div className="rounded-xl bg-nevoa p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 text-sm font-semibold">Pagamento</span>
              <PaymentButton
                number={order.number}
                status={order.paymentStatus}
                disabled={order.status === "canceled"}
                onClick={() => onPay(order)}
              />
            </div>
            {order.status !== "canceled" && (
              <p className="mt-1 text-xs text-tinta/70">Marque como pago assim que o cliente pagar</p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge kind={order.kind} status={order.status} />
          <DueBadge flag={order.dueFlag} />
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-tinta/60">Tipo</dt>
            <dd className="font-semibold">{ORDER_KIND_LABEL[order.kind]}</dd>
          </div>
          {isClient && (
            <div>
              <dt className="text-xs text-tinta/60">Cliente</dt>
              <dd className="font-semibold">{order.customerName}</dd>
            </div>
          )}
          {isClient && !restricted && order.customerPhone && (
            <div>
              <dt className="text-xs text-tinta/60">Telefone</dt>
              <dd className="font-semibold">{formatPhone(order.customerPhone)}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-tinta/60">Prazo de entrega</dt>
            <dd className="font-semibold">{order.dueDate ? formatDate(order.dueDate) : "Sem prazo"}</dd>
          </div>
          {isClient && order.status === "shipped" && (
            <div>
              <dt className="text-xs text-tinta/60">Código de rastreio</dt>
              <dd className="font-semibold">{order.trackingCode ?? "Não informado"}</dd>
            </div>
          )}
          {!restricted && (
            <div>
              <dt className="text-xs text-tinta/60">Total</dt>
              <dd className="font-extrabold text-violeta">{formatBRL(order.totalBrl)}</dd>
            </div>
          )}
        </dl>
        {!restricted && order.notes && (
          <p className="whitespace-pre-line rounded-xl bg-nevoa p-3 text-sm">{order.notes}</p>
        )}

        <section aria-labelledby="order-items">
          <h3 id="order-items" className="text-sm font-bold uppercase tracking-wide text-violeta-escuro">
            Itens
          </h3>
          <ul className="mt-2 divide-y divide-violeta/10 text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="py-2">
                <div className="flex items-start justify-between gap-3">
                  <span>
                    {item.description}
                    <span className="block text-xs text-tinta/60">
                      {restricted ? `Quantidade: ${item.quantity}` : `${item.quantity} x ${formatBRL(item.unitPrice)}`}
                    </span>
                  </span>
                  {!restricted && (
                    <span className="shrink-0 font-semibold">{formatBRL(item.lineTotal)}</span>
                  )}
                </div>
                <ItemModel
                  itemId={item.id}
                  description={item.description}
                  model={item.model}
                  canSet={canSetModel && !locked}
                  canOpenModelsPage={canOpenModels}
                />
              </li>
            ))}
          </ul>
        </section>

        {!restricted && <NotifyButton order={order} onRegisterPhone={() => onEdit(true)} />}

        <section aria-label="Etapas do pedido" className="@container space-y-3">
          <OrderNav
            orderNumber={order.number}
            kind={order.kind}
            status={order.status}
            onMove={(to) => onMove(order, to)}
            onDelete={() => onDelete(order)}
            menuPlacement="down"
            restricted={restricted}
          />
          {!locked && !restricted && (
            <Button variant="secondary" size="sm" className="min-h-11" onClick={() => onEdit(false)}>
              Editar dados do pedido
            </Button>
          )}
        </section>

        {!restricted && <History orderId={order.id} />}
      </PanelBody>
      <PanelFooter>
        <Button variant="secondary" onClick={onClose}>
          Fechar
        </Button>
      </PanelFooter>
    </>
  );
}

export function OrderPanel({ restricted, canSetModel, canOpenModels, order, onClose, onMove, onPay, onDelete }: OrderPanelProps) {
  const [editing, setEditing] = useState<{ focusPhone: boolean } | null>(null);

  const close = () => {
    setEditing(null);
    onClose();
  };

  return (
    <SidePanel
      open={order !== null}
      onClose={close}
      title={order ? `Pedido #${order.number}` : "Pedido"}
    >
      {order &&
        (editing ? (
          <EditForm order={order} focusPhone={editing.focusPhone} onDone={() => setEditing(null)} />
        ) : (
          <Details
            restricted={restricted}
            canSetModel={canSetModel}
            canOpenModels={canOpenModels}
            order={order}
            onEdit={(focusPhone) => setEditing({ focusPhone })}
            onMove={onMove}
            onPay={onPay}
            onDelete={onDelete}
            onClose={close}
          />
        ))}
    </SidePanel>
  );
}
