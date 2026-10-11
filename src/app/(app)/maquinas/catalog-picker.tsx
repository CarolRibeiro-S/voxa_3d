"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  PRINTER_TYPE_LABEL,
  PRINTER_TYPES,
  type CatalogListItem,
  type CatalogPrinterView,
} from "@/lib/printers-schema";
import { cn } from "@/lib/utils";
import type { PrinterType } from "@/types/database";
import { getCatalogPrinter, listCatalogPrinters } from "./actions";

interface CatalogPickerProps {
  // null enquanto a lista ainda não foi carregada (carrega uma vez).
  items: CatalogListItem[] | null;
  onLoaded: (items: CatalogListItem[]) => void;
  onSelect: (printer: CatalogPrinterView) => void;
}

const normalize = (s: string) =>
  s.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{Diacritic}/gu, "");

export function CatalogPicker({ items, onLoaded, onSelect }: CatalogPickerProps) {
  const [type, setType] = useState<PrinterType>("fdm");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [choosing, startChoosing] = useTransition();
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    if (items !== null) return;
    let cancelled = false;
    listCatalogPrinters().then((result) => {
      if (cancelled) return;
      if (result.ok) onLoaded(result.items);
      else setError(result.message);
    });
    return () => {
      cancelled = true;
    };
  }, [items, onLoaded]);

  const loading = items === null && error === null;
  const q = normalize(query.trim());
  const filtered = (items ?? []).filter(
    (item) =>
      item.type === type && normalize(`${item.brand} ${item.model}`).includes(q),
  );

  function choose(item: CatalogListItem) {
    setError(null);
    setChosen(`${item.brand}|${item.model}`);
    startChoosing(async () => {
      const result = await getCatalogPrinter(item.brand, item.model);
      if (result.ok) onSelect(result.printer);
      else setError(result.message);
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
      <div role="tablist" aria-label="Tipo de impressora" className="flex gap-2">
        {PRINTER_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={t === type}
            onClick={() => setType(t)}
            className={cn(
              "min-h-11 rounded-xl px-5 text-sm font-semibold transition-colors",
              t === type ? "bg-violeta text-white" : "bg-nevoa text-tinta hover:bg-violeta/10",
            )}
          >
            {PRINTER_TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-tinta/50"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por marca ou modelo"
          aria-label="Buscar por marca ou modelo"
          className="min-h-11 pl-10"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto" aria-busy={loading || choosing}>
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-tinta/70" role="status">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            Carregando o catálogo...
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-tinta/70">
            {items === null
              ? "Não foi possível carregar o catálogo."
              : "Nenhuma máquina encontrada. Você pode cadastrar como outra máquina."}
          </p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((item) => {
              const key = `${item.brand}|${item.model}`;
              return (
                <li key={key}>
                  <button
                    type="button"
                    disabled={choosing}
                    onClick={() => choose(item)}
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-violeta/10 bg-white px-4 py-2 text-left text-sm shadow-sm transition-colors hover:bg-nevoa disabled:opacity-60"
                  >
                    <span>
                      <span className="font-semibold">{item.model}</span>
                      <span className="ml-2 text-tinta/60">{item.brand}</span>
                    </span>
                    {choosing && chosen === key && (
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
