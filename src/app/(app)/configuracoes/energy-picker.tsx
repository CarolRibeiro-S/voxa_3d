"use client";

import { useEffect, useRef, useState } from "react";
import { Info, Loader2, TriangleAlert, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanelBody, PanelFooter, SidePanel } from "@/components/ui/side-panel";
import {
  ENERGY_GROUPS,
  ENERGY_GROUP_LABEL,
  type EnergyDistributor,
  type EnergyGroup,
  type EnergyTariff,
} from "@/lib/energy-schema";
import { formatDate, formatKwh } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getEnergyTariffAction, listEnergyDistributorsAction } from "./actions";

export interface EnergyPick {
  distributor: EnergyDistributor;
  group: EnergyGroup;
  kwhBrl: number;
}

interface EnergyPickerProps {
  // Distribuidora e grupo atuais do formulário (a conta já pode ter salvo uma).
  distributorId: string | null;
  group: EnergyGroup | null;
  onApply: (pick: EnergyPick) => void;
  // Avisa o formulário dos nomes recebidos, para mostrar nome em vez de código.
  onDistributorsLoaded: (list: EnergyDistributor[]) => void;
}

// Tira acentos e caixa para a busca ignorar as diferenças.
const plain = (value: string) =>
  value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function PickerBody({
  distributorId,
  group: initialGroup,
  onApply,
  onDistributorsLoaded,
  onClose,
}: EnergyPickerProps & { onClose: () => void }) {
  const [distributors, setDistributors] = useState<EnergyDistributor[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(distributorId);
  const [group, setGroup] = useState<EnergyGroup>(initialGroup ?? "B1");
  const [tariff, setTariff] = useState<EnergyTariff | null>(null);
  const [tariffLoading, setTariffLoading] = useState(false);
  const [tariffError, setTariffError] = useState<string | null>(null);
  const latestRequest = useRef(0);

  // A lista é buscada uma vez, quando o painel abre.
  useEffect(() => {
    let active = true;
    listEnergyDistributorsAction().then((result) => {
      if (!active) return;
      if (result.ok) {
        setDistributors(result.data);
        onDistributorsLoaded(result.data);
      } else {
        setListError(result.error);
        setDistributors([]);
      }
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchTariff(id: string, nextGroup: EnergyGroup) {
    const request = ++latestRequest.current;
    setTariff(null);
    setTariffError(null);
    setTariffLoading(true);
    const result = await getEnergyTariffAction({ distributorId: id, group: nextGroup });
    // Ignora respostas de pedidos antigos.
    if (request !== latestRequest.current) return;
    setTariffLoading(false);
    if (result.ok) setTariff(result.data);
    else setTariffError(result.error);
  }

  function chooseDistributor(id: string) {
    setSelectedId(id);
    void fetchTariff(id, group);
  }

  function chooseGroup(next: EnergyGroup) {
    setGroup(next);
    if (selectedId) void fetchTariff(selectedId, next);
  }

  const query = plain(search.trim());
  const visible = (distributors ?? []).filter(
    (d) => query === "" || plain(d.name).includes(query) || plain(d.state).includes(query),
  );
  const selected = distributors?.find((d) => d.id === selectedId) ?? null;

  function apply() {
    if (!tariff || !selected) return;
    onApply({
      distributor: selected,
      group,
      // O campo de energia tem quatro casas decimais.
      kwhBrl: Math.round(tariff.kwhBrl * 10_000) / 10_000,
    });
    onClose();
  }

  return (
    <>
      <PanelBody>
        <div>
          <label htmlFor="energy-search" className="mb-1.5 block text-sm font-medium text-tinta">
            Distribuidora
          </label>
          <input
            id="energy-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Busque por nome ou estado"
            autoComplete="off"
            className="h-11 w-full rounded-xl border border-violeta/20 bg-white px-4 text-sm text-tinta shadow-sm outline-none transition placeholder:text-tinta/40 focus:border-violeta focus:ring-2 focus:ring-violeta/20"
          />
        </div>

        {distributors === null ? (
          <p role="status" className="flex items-center gap-2 text-sm text-tinta/60">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            Carregando distribuidoras...
          </p>
        ) : listError ? (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {listError}
          </p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-tinta/60">Nenhuma distribuidora encontrada.</p>
        ) : (
          <ul
            className="max-h-64 divide-y divide-violeta/10 overflow-y-auto rounded-xl border border-violeta/20"
            aria-label="Distribuidoras"
          >
            {visible.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  aria-pressed={d.id === selectedId}
                  onClick={() => chooseDistributor(d.id)}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-violeta",
                    d.id === selectedId
                      ? "bg-violeta font-semibold text-white"
                      : "bg-white hover:bg-nevoa",
                  )}
                >
                  <span>{d.name}</span>
                  <span className="shrink-0 text-xs opacity-80">{d.state}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-tinta">Tipo de ligação</legend>
          <div className="grid grid-cols-2 gap-2">
            {ENERGY_GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={g === group}
                onClick={() => chooseGroup(g)}
                className={cn(
                  "min-h-11 py-2 leading-tight rounded-xl border px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta",
                  g === group
                    ? "border-violeta bg-violeta text-white"
                    : "border-violeta/20 bg-white hover:bg-nevoa",
                )}
              >
                {ENERGY_GROUP_LABEL[g]}
              </button>
            ))}
          </div>
        </fieldset>

        <div aria-live="polite">
          {tariffLoading && (
            <p role="status" className="flex items-center gap-2 text-sm text-tinta/60">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Consultando a tarifa...
            </p>
          )}
          {tariffError && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {tariffError}
            </p>
          )}
          {!tariff && !tariffLoading && !tariffError && selectedId && selected && (
            <Button variant="secondary" onClick={() => void fetchTariff(selectedId, group)}>
              Consultar tarifa
            </Button>
          )}
          {tariff && (
            <div className="space-y-3 rounded-xl bg-nevoa p-4">
              <p className="text-2xl font-extrabold text-violeta-escuro">
                {formatKwh(tariff.kwhBrl)} <span className="text-base font-semibold">por kWh</span>
              </p>
              <p className="text-sm">
                {tariff.distributorName} ({tariff.state}), {ENERGY_GROUP_LABEL[tariff.group]}
              </p>
              {tariff.validTo && (
                <p className="text-sm text-tinta/70">Vigência até {formatDate(tariff.validTo)}</p>
              )}
              {tariff.estimatedTaxes && (
                <p className="flex gap-2 rounded-xl border border-violeta/20 bg-white p-3 text-xs text-tinta/80">
                  <Info size={16} className="mt-px shrink-0 text-violeta" aria-hidden="true" />
                  <span>
                    Valor com impostos estimados (ICMS do estado e PIS/COFINS médios). Confira na
                    sua conta de luz.
                  </span>
                </p>
              )}
              {tariff.expired && (
                <p className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <TriangleAlert
                    size={16}
                    className="mt-px shrink-0 text-amber-600"
                    aria-hidden="true"
                  />
                  <span>Esta tarifa está vencida. O valor pode estar desatualizado.</span>
                </p>
              )}
            </div>
          )}
        </div>
      </PanelBody>
      <PanelFooter>
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={apply} disabled={!tariff || !selected}>
          Usar este valor
        </Button>
      </PanelFooter>
    </>
  );
}

export function EnergyPicker(props: EnergyPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2">
      <Button variant="secondary" size="sm" className="min-h-11" onClick={() => setOpen(true)} data-tour="config-energia">
        <Zap size={16} aria-hidden="true" />
        Preencher pela minha distribuidora
      </Button>
      <p className="mt-1 text-xs text-tinta/60">
        Busque a sua distribuidora e escolha o tipo de ligação. Você pode ajustar o valor depois.
      </p>
      <SidePanel open={open} onClose={() => setOpen(false)} title="Tarifa de energia">
        <PickerBody {...props} onClose={() => setOpen(false)} />
      </SidePanel>
    </div>
  );
}
