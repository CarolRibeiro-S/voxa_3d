"use client";

import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { CalcBreakdown, CalcSuccess } from "@/lib/calc-types";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

function breakdownRows(r: CalcBreakdown): { label: string; value: number }[] {
  return [
    { label: "Material", value: r.material },
    { label: "Energia", value: r.energy },
    { label: "Desgaste da máquina", value: r.wear },
    { label: "Manutenção", value: r.maintenance },
    { label: "Seu tempo", value: r.labor },
    { label: "Extras", value: r.extras },
    { label: "Embalagem", value: r.packaging },
    { label: "Falhas", value: r.failures },
    { label: "Taxas e imposto", value: r.fees },
    { label: "Lucro", value: r.profit },
  ];
}

interface ResultPanelProps {
  result: CalcSuccess | null;
  error: string | null;
  stale: boolean;
  pending: boolean;
  // Ações sob o preço, como salvar em um orçamento.
  actions?: ReactNode;
}

export function ResultPanel({ result, error, stale, pending, actions }: ResultPanelProps) {
  return (
    <div className="lg:sticky lg:top-6" aria-live="polite" aria-busy={pending}>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {result === null ? (
        <Card className="bg-nevoa text-center">
          <p className="font-semibold">Seu preço aparece aqui</p>
          <p className="mt-1 text-sm text-tinta/70">
            Preencha os dados e clique em Calcular preço.
          </p>
        </Card>
      ) : (
        <div className={cn("space-y-4 transition-opacity", (stale || pending) && "opacity-60")}>
          {stale && (
            <p className="rounded-xl bg-nevoa p-3 text-sm font-medium text-violeta-escuro">
              Valores alterados, clique em Calcular preço
            </p>
          )}

          <Card variant="dark">
            <span className="inline-block rounded-full bg-limao px-3 py-1 text-xs font-bold text-tinta">
              Preço sugerido por peça
            </span>
            <p className="mt-3 text-4xl font-extrabold">{formatBRL(result.perUnit.price)}</p>
            {result.quantity > 1 && (
              <p className="mt-3 border-t border-white/15 pt-3 text-sm text-white/80">
                Total de {result.quantity} peças:{" "}
                <strong className="text-base text-white">{formatBRL(result.total.price)}</strong>
              </p>
            )}
          </Card>

          {actions}

          <Card>
            <h2 className="text-sm font-bold uppercase tracking-wide text-violeta-escuro">
              Detalhamento por peça
            </h2>
            <dl className="mt-3 divide-y divide-violeta/10 text-sm">
              {breakdownRows(result.perUnit).map((row) => (
                <div key={row.label} className="flex items-center justify-between py-2">
                  <dt className="text-tinta/70">{row.label}</dt>
                  <dd className={cn("font-semibold", row.label === "Lucro" && "text-violeta")}>
                    {formatBRL(row.value)}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          {result.warnings.length > 0 && (
            <ul className="space-y-2">
              {result.warnings.map((warning) => (
                <li
                  key={warning}
                  className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
                >
                  <TriangleAlert
                    size={16}
                    className="mt-px shrink-0 text-amber-600"
                    aria-hidden="true"
                  />
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
