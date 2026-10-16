"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Search } from "lucide-react";
import { listModelOptions } from "@/app/(app)/modelos/actions";
import { ModelPhoto } from "@/components/models/model-photo";
import { Input } from "@/components/ui/input";
import type { ModelOption } from "@/lib/models-schema";
import { cn } from "@/lib/utils";

interface ModelPickerProps {
  id: string;
  label?: string;
  value: ModelOption | null;
  onChange: (option: ModelOption | null) => void;
  disabled?: boolean;
}

// Seletor "Modelo": nunca obrigatório. Busca por nome no servidor (poucos resultados por vez,
// com miniatura assinada) e tem a opção "Sem modelo".
export function ModelPicker({ id, label = "Modelo (opcional)", value, onChange, disabled }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ModelOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Só a resposta da última busca vale.
  const requestId = useRef(0);

  async function load(text: string) {
    const current = ++requestId.current;
    setLoading(true);
    setError(null);
    const result = await listModelOptions(text);
    if (current !== requestId.current) return;
    setLoading(false);
    if (result.ok) setOptions(result.options);
    else {
      setOptions([]);
      setError(result.message);
    }
  }

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setQuery("");
    void load("");
  }

  function onSearch(text: string) {
    setQuery(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void load(text), 250);
  }

  function choose(option: ModelOption | null) {
    onChange(option);
    setOpen(false);
  }

  const listId = `${id}-list`;

  return (
    <div>
      <p id={`${id}-label`} className="mb-1.5 text-sm font-medium text-tinta">
        {label}
      </p>
      <button
        type="button"
        id={id}
        onClick={toggle}
        disabled={disabled}
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={`${id}-label ${id}`}
        className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-violeta/20 bg-white px-3 py-2 text-left text-sm shadow-sm outline-none transition focus:border-violeta focus:ring-2 focus:ring-violeta/20 disabled:opacity-60"
      >
        {value && <ModelPhoto url={value.photoUrl} name={value.name} className="size-8 rounded-lg" />}
        <span className={cn("min-w-0 flex-1 break-words leading-tight", !value && "text-tinta/60")}>
          {value ? value.name : "Sem modelo"}
        </span>
        <ChevronDown size={16} className="shrink-0 text-tinta/60" aria-hidden="true" />
      </button>

      {open && (
        <div id={listId} className="mt-2 space-y-2 rounded-xl border border-violeta/20 bg-white p-2 shadow-sm">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta/50"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Buscar por nome"
              aria-label="Buscar modelo por nome"
              autoComplete="off"
              maxLength={80}
              className="min-h-11 pl-9"
            />
          </div>
          <ul className="max-h-56 space-y-1 overflow-y-auto" role="listbox" aria-label="Modelos">
            <li role="option" aria-selected={value === null}>
              <button
                type="button"
                onClick={() => choose(null)}
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-nevoa"
              >
                <span className="min-w-0 flex-1">Sem modelo</span>
                {value === null && <Check size={16} className="shrink-0 text-violeta" aria-hidden="true" />}
              </button>
            </li>
            {(options ?? []).map((option) => (
              <li key={option.id} role="option" aria-selected={value?.id === option.id}>
                <button
                  type="button"
                  onClick={() => choose(option)}
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-nevoa"
                >
                  <ModelPhoto url={option.photoUrl} name={option.name} className="size-9 rounded-lg" />
                  <span className="min-w-0 flex-1 break-words leading-tight">{option.name}</span>
                  {value?.id === option.id && (
                    <Check size={16} className="shrink-0 text-violeta" aria-hidden="true" />
                  )}
                </button>
              </li>
            ))}
          </ul>
          {loading && (
            <p role="status" className="flex items-center gap-2 px-2 text-xs text-tinta/60">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              Buscando...
            </p>
          )}
          {!loading && options !== null && options.length === 0 && !error && (
            <p className="px-2 text-xs text-tinta/60">
              {query.trim() ? "Nenhum modelo com esse nome." : "Você ainda não cadastrou modelos."}
            </p>
          )}
          {error && (
            <p role="alert" className="px-2 text-xs text-red-600">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
