"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Plus, Search } from "lucide-react";
import { ModelPhoto } from "@/components/models/model-photo";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { SidePanel } from "@/components/ui/side-panel";
import { formatPrintTime, type ModelCardData } from "@/lib/models-schema";
import { removeModel } from "./actions";
import { ModelForm } from "./model-form";

// Tira acentos e caixa para a busca ignorar as diferenças.
const plain = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const numberFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

function ModelCard({
  model,
  canManage,
  onEdit,
}: {
  model: ModelCardData;
  canManage: boolean;
  onEdit: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const details = [
    model.materialHint,
    model.printMinutes !== null ? formatPrintTime(model.printMinutes) : null,
    model.weightG !== null ? `${numberFormat.format(model.weightG)} g` : null,
  ].filter((part): part is string => !!part);

  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      <ModelPhoto url={model.photoUrl} name={model.name} className="w-full" />
      <div className="min-w-0 flex-1">
        <p className="break-words font-bold leading-tight">{model.name}</p>
        {details.length > 0 ? (
          <p className="mt-1 text-sm text-tinta/70">{details.join(" | ")}</p>
        ) : (
          <p className="mt-1 text-sm text-tinta/50">Sem material, tempo ou peso padrão</p>
        )}
        {model.sourceUrl && (
          <a
            href={model.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-violeta hover:text-violeta-escuro"
          >
            <ExternalLink size={14} className="shrink-0" aria-hidden="true" />
            Link de origem
          </a>
        )}
      </div>
      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
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
        title="Remover este modelo?"
        description={`O modelo "${model.name}" irá para a Lixeira e pode ser restaurado em Histórico. Os pedidos antigos continuam mostrando o modelo, com o selo removido.`}
        confirmLabel="Remover modelo"
        variant="danger"
        onConfirm={() => removeModel(model.id)}
      />
    </Card>
  );
}

export function ModelsView({
  models,
  max,
  used,
  isPro,
  canManage,
}: {
  models: ModelCardData[];
  max: number;
  used: number;
  isPro: boolean;
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");
  // null: painel fechado. { model: null }: novo modelo.
  const [editing, setEditing] = useState<{ model: ModelCardData | null } | null>(null);
  const full = used >= max;

  const term = plain(search.trim());
  const shown = term ? models.filter((m) => plain(m.name).includes(term)) : models;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-extrabold">
            {used} de {max} modelos
          </p>
          {full && (
            <p className="text-sm text-tinta/70">Seu plano permite até {max} modelos.</p>
          )}
        </div>
        {canManage &&
          (full ? (
            isPro && (
              <Link href="/assinatura" className={buttonClasses({})}>
                Ver o plano Loja
              </Link>
            )
          ) : (
            <Button data-tour="modelos-novo" onClick={() => setEditing({ model: null })}>
              <Plus size={16} aria-hidden="true" />
              Novo modelo
            </Button>
          ))}
      </div>

      {models.length > 0 && (
        <div className="relative max-w-md">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta/50"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome"
            aria-label="Buscar modelo por nome"
            autoComplete="off"
            maxLength={80}
            className="min-h-11 pl-9"
          />
        </div>
      )}

      {models.length === 0 ? (
        <Card className="text-center">
          <p className="font-semibold">Nenhum modelo cadastrado ainda</p>
          <p className="mt-1 text-sm text-tinta/70">
            Cadastre os desenhos que você imprime. Com a foto e as observações de impressão, quem
            imprime o pedido sabe exatamente o que fazer.
          </p>
          {canManage && (
            <Button className="mt-4" onClick={() => setEditing({ model: null })}>
              <Plus size={16} aria-hidden="true" />
              Novo modelo
            </Button>
          )}
        </Card>
      ) : shown.length === 0 ? (
        <p role="status" className="rounded-xl bg-nevoa p-4 text-sm text-tinta/70">
          Nenhum modelo com esse nome.
        </p>
      ) : (
        <ul data-tour="modelos-lista" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((model) => (
            <li key={model.id}>
              <ModelCard model={model} canManage={canManage} onEdit={() => setEditing({ model })} />
            </li>
          ))}
        </ul>
      )}

      <SidePanel
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.model ? "Editar modelo" : "Novo modelo"}
      >
        {editing && (
          <ModelForm
            model={editing.model}
            isPro={isPro}
            onDone={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        )}
      </SidePanel>
    </>
  );
}
