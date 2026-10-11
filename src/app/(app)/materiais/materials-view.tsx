"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatBRL } from "@/lib/format";
import {
  costPerUnit,
  formatUnitCost,
  isHexColor,
  KIND_INFO,
} from "@/lib/materials-schema";
import { cn } from "@/lib/utils";
import type { Material, MaterialKind } from "@/types/database";
import { setMaterialActive } from "./actions";
import { MaterialForm } from "./material-form";

type Editing = { material: Material | null } | null;

const numberFormat = new Intl.NumberFormat("pt-BR");

function sizeText(value: number, kind: MaterialKind) {
  return `${numberFormat.format(value)} ${KIND_INFO[kind].unit}`;
}

function unitCostText(m: Material) {
  const cost = Number.isFinite(m.cost_per_unit)
    ? m.cost_per_unit
    : costPerUnit(m.price_brl, m.package_size);
  return cost === null ? "-" : `${formatUnitCost(cost)}/${KIND_INFO[m.kind].unit}`;
}

function ColorCell({ color }: { color: string | null }) {
  if (!color) return <span className="text-tinta/40">-</span>;
  return (
    <span className="inline-flex items-center gap-2">
      {isHexColor(color) && (
        <span
          className="size-4 shrink-0 rounded-full border border-tinta/20"
          style={{ backgroundColor: color.trim() }}
          aria-hidden="true"
        />
      )}
      {color}
    </span>
  );
}

function MaterialActions({
  material,
  onEdit,
}: {
  material: Material;
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function change(isActive: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setMaterialActive(material.id, isActive);
      if (!result.ok) setError(result.message);
      setConfirming(false);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" className="min-h-11" onClick={onEdit}>
        Editar
      </Button>
      {material.is_active ? (
        confirming ? (
          <>
            <Button
              variant="dark"
              size="sm"
              className="min-h-11"
              disabled={pending}
              onClick={() => change(false)}
            >
              Confirmar arquivar
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
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11"
            onClick={() => setConfirming(true)}
          >
            Arquivar
          </Button>
        )
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="min-h-11"
          disabled={pending}
          onClick={() => change(true)}
        >
          Restaurar
        </Button>
      )}
      {error && (
        <p role="alert" className="w-full text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function MaterialsView({
  kind,
  materials,
}: {
  kind: MaterialKind;
  materials: Material[];
}) {
  const info = KIND_INFO[kind];
  const [editing, setEditing] = useState<Editing>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Muda a cada abertura para o formulário começar do zero.
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // O dialog nativo cuida de Esc, foco preso e retorno do foco ao botão.
    if (editing && !dialog.open) dialog.showModal();
    if (!editing && dialog.open) dialog.close();
  }, [editing]);

  function open(material: Material | null) {
    setFormKey((k) => k + 1);
    setEditing({ material });
  }
  const close = () => setEditing(null);

  const activeMaterials = materials.filter((m) => m.is_active);

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => open(null)}>
          <Plus size={16} aria-hidden="true" />
          Novo material
        </Button>
      </div>

      {materials.length === 0 ? (
        <Card className="text-center">
          <p className="font-semibold">
            Nenhum {info.label.toLowerCase()} cadastrado ainda
          </p>
          <p className="mt-1 text-sm text-tinta/70">
            Cadastre seus materiais para calcular o custo das peças.
          </p>
          <Button className="mt-4" onClick={() => open(null)}>
            Cadastrar material
          </Button>
        </Card>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-violeta/10 bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-nevoa text-xs uppercase tracking-wide text-tinta/60">
                <tr>
                  <th scope="col" className="px-4 py-3">Nome</th>
                  <th scope="col" className="px-4 py-3">Marca</th>
                  <th scope="col" className="px-4 py-3">Tipo</th>
                  <th scope="col" className="px-4 py-3">Cor</th>
                  <th scope="col" className="px-4 py-3">Preço pago</th>
                  <th scope="col" className="px-4 py-3">Tamanho</th>
                  <th scope="col" className="px-4 py-3">Custo</th>
                  <th scope="col" className="px-4 py-3">Estoque</th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-violeta/10">
                {materials.map((m) => (
                  <tr key={m.id} className={cn(!m.is_active && "opacity-60")}>
                    <td className="px-4 py-3 font-semibold">
                      {m.name}
                      {!m.is_active && (
                        <Badge variant="warning" className="ml-2">
                          Arquivado
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">{m.brand ?? "-"}</td>
                    <td className="px-4 py-3">{m.material_type ?? "-"}</td>
                    <td className="px-4 py-3"><ColorCell color={m.color} /></td>
                    <td className="px-4 py-3">{formatBRL(m.price_brl)}</td>
                    <td className="px-4 py-3">{sizeText(m.package_size, m.kind)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{unitCostText(m)}</td>
                    <td className="px-4 py-3">
                      {m.stock_remaining === null
                        ? "-"
                        : sizeText(m.stock_remaining, m.kind)}
                    </td>
                    <td className="px-4 py-3">
                      <MaterialActions material={m} onEdit={() => open(m)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {materials.map((m) => (
              <li key={m.id}>
                <Card className={cn("p-4", !m.is_active && "opacity-60")}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{m.name}</p>
                      <p className="text-xs text-tinta/60">
                        {[m.brand, m.material_type].filter(Boolean).join(" | ") || "-"}
                      </p>
                    </div>
                    {!m.is_active && <Badge variant="warning">Arquivado</Badge>}
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-tinta/60">Cor</dt>
                      <dd><ColorCell color={m.color} /></dd>
                    </div>
                    <div>
                      <dt className="text-xs text-tinta/60">Preço pago</dt>
                      <dd>{formatBRL(m.price_brl)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-tinta/60">Tamanho</dt>
                      <dd>{sizeText(m.package_size, m.kind)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-tinta/60">Custo</dt>
                      <dd className="font-semibold text-violeta">{unitCostText(m)}</dd>
                    </div>
                    {m.stock_remaining !== null && (
                      <div>
                        <dt className="text-xs text-tinta/60">Estoque</dt>
                        <dd>{sizeText(m.stock_remaining, m.kind)}</dd>
                      </div>
                    )}
                  </dl>
                  <div className="mt-3">
                    <MaterialActions material={m} onEdit={() => open(m)} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby="material-dialog-title"
        onClose={close}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-white p-0 text-tinta shadow-xl backdrop:bg-tinta/50 md:left-auto md:right-0 md:w-[28rem]"
      >
        {editing && (
          <div className="flex h-dvh flex-col">
            <div className="flex items-center justify-between border-b border-violeta/10 p-4 md:px-6">
              <h2 id="material-dialog-title" className="text-lg font-extrabold">
                {editing.material
                  ? `Editar ${info.label.toLowerCase()}`
                  : `Novo ${info.label.toLowerCase()}`}
              </h2>
              <button
                type="button"
                onClick={close}
                className="flex size-11 items-center justify-center rounded-xl hover:bg-nevoa"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>
            <MaterialForm
              key={formKey}
              kind={kind}
              material={editing.material}
              activeMaterials={activeMaterials}
              onDone={close}
              onCancel={close}
            />
          </div>
        )}
      </dialog>
    </>
  );
}
