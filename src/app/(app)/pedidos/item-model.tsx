"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { ModelPhoto } from "@/components/models/model-photo";
import { ModelPicker } from "@/components/models/model-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmSaveDialog } from "@/components/ui/confirm-save-dialog";
import { PanelBody, PanelFooter, SidePanel } from "@/components/ui/side-panel";
import type { ModelOption, OrderModelInfo } from "@/lib/models-schema";
import { setOrderItemModel } from "./actions";

// Modelo de um item do pedido. Todos os papéis veem foto, nome, material, observações de
// impressão e link de origem. Só quem gerencia pedidos troca o modelo (nunca dinheiro aqui).
export function ItemModel({
  itemId,
  description,
  model,
  canSet,
  canOpenModelsPage,
}: {
  itemId: string;
  description: string;
  model: OrderModelInfo | null;
  canSet: boolean;
  canOpenModelsPage: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState<ModelOption | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function open() {
    setPicked(model ? { id: model.id, name: model.name, photoUrl: model.photoUrl } : null);
    setNotice(null);
    setEditing(true);
  }

  function review() {
    if ((picked?.id ?? null) === (model?.id ?? null)) {
      setNotice("Nenhuma alteração para salvar");
      return;
    }
    setNotice(null);
    setConfirming(true);
  }

  return (
    <div className="mt-2 space-y-2">
      {model && (
        <div className="flex items-start gap-3 rounded-xl bg-nevoa p-3">
          <ModelPhoto url={model.photoUrl} name={model.name} className="size-20" />
          <div className="min-w-0 flex-1 space-y-1 text-sm">
            <p className="break-words font-semibold leading-tight">
              {model.name}{" "}
              {model.removed && (
                <Badge variant="warning" className="align-middle">
                  removido
                </Badge>
              )}
            </p>
            {model.materialHint && <p className="text-tinta/70">{model.materialHint}</p>}
            {model.printNotes && (
              <p className="whitespace-pre-line break-words text-tinta/80">{model.printNotes}</p>
            )}
            {model.sourceUrl && (
              <a
                href={model.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1 font-medium text-violeta hover:text-violeta-escuro"
              >
                <ExternalLink size={14} className="shrink-0" aria-hidden="true" />
                Link de origem
              </a>
            )}
          </div>
        </div>
      )}

      {(canSet || (model && canOpenModelsPage)) && (
        <div className="flex flex-wrap items-center gap-2">
          {canSet && (
            <Button variant="secondary" size="sm" className="min-h-11" onClick={open}>
              {model ? "Trocar modelo" : "Definir modelo"}
            </Button>
          )}
          {canOpenModelsPage && (
            <Link
              href="/modelos"
              className="inline-flex min-h-11 items-center text-sm font-medium text-violeta hover:text-violeta-escuro"
            >
              Abrir Modelos
            </Link>
          )}
        </div>
      )}

      <SidePanel open={editing} onClose={() => setEditing(false)} title="Modelo do item">
        <PanelBody>
          <p className="text-sm text-tinta/70">Item: {description}</p>
          <ModelPicker id={`item-model-${itemId}`} value={picked} onChange={setPicked} />
          {notice && (
            <p role="status" className="text-sm font-medium text-tinta/70">
              {notice}
            </p>
          )}
        </PanelBody>
        <PanelFooter>
          <Button variant="secondary" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
          <Button onClick={review}>Salvar</Button>
        </PanelFooter>
        <ConfirmSaveDialog
          open={confirming}
          onOpenChange={setConfirming}
          changes={[
            { label: "Modelo", from: model?.name ?? "Sem modelo", to: picked?.name ?? "Sem modelo" },
          ]}
          onConfirm={async () => {
            const result = await setOrderItemModel(itemId, picked?.id ?? null);
            if (!result.ok) return result;
            setEditing(false);
          }}
        />
      </SidePanel>
    </div>
  );
}
