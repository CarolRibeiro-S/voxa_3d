import Link from "next/link";
import { Pencil, Plus, RotateCcw, Trash2, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  ENTITY_GROUPS,
  listActivity,
  listTrash,
  type ActivityPeriod,
  type EntityGroup,
} from "@/lib/audit";
import { formatDateTime } from "@/lib/format";
import { getCurrentTenant } from "@/lib/tenant";
import { cn } from "@/lib/utils";
import type { AuditAction } from "@/types/database";
import { RestoreButton, UndoButton } from "./history-buttons";

export const metadata = { title: "Histórico | Voxa3D" };

const ACTION_ICON: Record<AuditAction, LucideIcon> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
  restore: RotateCcw,
};

const PERIODS: { value: ActivityPeriod; label: string }[] = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "all", label: "Tudo" },
];

type SearchParams = { aba?: string; tipo?: string; periodo?: string; pagina?: string };

const selectClass =
  "min-h-11 rounded-xl border border-violeta/20 bg-white px-4 text-sm text-tinta shadow-sm outline-none focus:border-violeta focus:ring-2 focus:ring-violeta/20";

function pageHref(params: { tipo: EntityGroup; periodo: ActivityPeriod; pagina: number }) {
  return `/historico?aba=atividades&tipo=${params.tipo}&periodo=${params.periodo}&pagina=${params.pagina}`;
}

async function Activities({
  group,
  period,
  page,
}: {
  group: EntityGroup;
  period: ActivityPeriod;
  page: number;
}) {
  const { entries, hasMore } = await listActivity({ group, period, page });

  return (
    <>
      <form method="get" className="flex flex-wrap items-end gap-3" role="search">
        <input type="hidden" name="aba" value="atividades" />
        <div>
          <Label htmlFor="tipo">Tipo</Label>
          <select id="tipo" name="tipo" defaultValue={group} className={selectClass}>
            {(Object.keys(ENTITY_GROUPS) as EntityGroup[]).map((g) => (
              <option key={g} value={g}>
                {ENTITY_GROUPS[g].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="periodo">Período</Label>
          <select id="periodo" name="periodo" defaultValue={period} className={selectClass}>
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      {entries.length === 0 ? (
        <Card className="text-center">
          <p className="font-semibold">Nenhuma atividade ainda</p>
          <p className="mt-1 text-sm text-tinta/70">
            As alterações que você fizer aparecem aqui, e muitas podem ser desfeitas.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3 md:space-y-0 md:divide-y md:divide-violeta/10 md:overflow-hidden md:rounded-xl md:border md:border-violeta/10 md:bg-white md:shadow-sm">
          {entries.map((entry) => {
            const Icon = ACTION_ICON[entry.action];
            return (
              <li
                key={entry.id}
                className={cn(
                  "rounded-xl border border-violeta/10 bg-white p-4 shadow-sm md:rounded-none md:border-0 md:shadow-none",
                  entry.reverted && "opacity-70",
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-nevoa text-violeta-escuro"
                    aria-hidden="true"
                  >
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{entry.phrase}</p>
                    <p className="text-xs text-tinta/60">{formatDateTime(entry.at)}</p>
                    {entry.fields.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-sm text-tinta/80">
                        {entry.fields.map((f) => (
                          <li key={f.label}>
                            {f.label}: {f.from} para {f.to}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {entry.reverted && <Badge>Desfeito</Badge>}
                    {entry.canUndo && <UndoButton logId={entry.id} />}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(page > 1 || hasMore) && (
        <nav aria-label="Páginas" className="flex items-center justify-between gap-3">
          {page > 1 ? (
            <Link
              href={pageHref({ tipo: group, periodo: period, pagina: page - 1 })}
              className="flex min-h-11 items-center text-sm font-semibold text-violeta hover:text-violeta-escuro"
            >
              Anterior
            </Link>
          ) : (
            <span />
          )}
          {hasMore && (
            <Link
              href={pageHref({ tipo: group, periodo: period, pagina: page + 1 })}
              className="flex min-h-11 items-center text-sm font-semibold text-violeta hover:text-violeta-escuro"
            >
              Próxima
            </Link>
          )}
        </nav>
      )}
    </>
  );
}

async function Trash() {
  const items = await listTrash();

  if (items.length === 0) {
    return (
      <Card className="text-center">
        <p className="font-semibold">A lixeira está vazia</p>
        <p className="mt-1 text-sm text-tinta/70">
          Máquinas, orçamentos e itens excluídos ficam aqui, e podem ser restaurados.
        </p>
      </Card>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={`${item.entity}-${item.id}`}>
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="break-words font-semibold">{item.name}</p>
              <p className="text-xs text-tinta/60">
                {item.typeLabel} | Excluído em {formatDateTime(item.deletedAt)}
              </p>
            </div>
            <RestoreButton entity={item.entity} id={item.id} name={item.name} />
          </Card>
        </li>
      ))}
    </ul>
  );
}

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const current = await getCurrentTenant();
  if (!current) return null; // O layout já mostra o erro de conta.

  const params = await searchParams;
  const tab = params.aba === "lixeira" ? "lixeira" : "atividades";
  const group = (Object.keys(ENTITY_GROUPS) as EntityGroup[]).find((g) => g === params.tipo) ?? "all";
  const period = PERIODS.find((p) => p.value === params.periodo)?.value ?? "30";
  const page = Math.min(Math.max(Number.parseInt(params.pagina ?? "1", 10) || 1, 1), 1000);

  const tabs = [
    { slug: "atividades", label: "Atividades" },
    { slug: "lixeira", label: "Lixeira" },
  ] as const;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-tinta">Histórico</h1>
        <p className="mt-1 text-sm text-tinta/70">
          Veja o que mudou na sua conta, desfaça alterações e restaure o que foi excluído.
        </p>
      </div>

      <nav aria-label="Seções do histórico" className="flex gap-2">
        {tabs.map((t) => (
          <Link
            key={t.slug}
            href={`/historico?aba=${t.slug}`}
            aria-current={t.slug === tab ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold transition-colors",
              t.slug === tab ? "bg-violeta text-white" : "bg-white text-tinta hover:bg-nevoa",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "atividades" ? (
        <Activities group={group} period={period} page={page} />
      ) : (
        <Trash />
      )}
    </div>
  );
}
