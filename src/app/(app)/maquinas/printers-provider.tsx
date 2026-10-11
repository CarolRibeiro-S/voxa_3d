"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { BookOpen, PenLine, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CatalogListItem, CatalogPrinterView } from "@/lib/printers-schema";
import type { TenantPrinter } from "@/types/database";
import { CatalogPicker } from "./catalog-picker";
import { PrinterForm } from "./printer-form";

type Mode = { kind: "new" } | { kind: "edit"; printer: TenantPrinter };
type Step = "choose" | "catalog" | "form";

interface PrinterDialogApi {
  openNew: () => void;
  openEdit: (printer: TenantPrinter) => void;
}

const PrinterDialogContext = createContext<PrinterDialogApi | null>(null);

export function usePrinterDialog() {
  const api = useContext(PrinterDialogContext);
  if (!api) throw new Error("usePrinterDialog fora do PrintersProvider");
  return api;
}

export function AddPrinterButton({ label = "Adicionar máquina" }: { label?: string }) {
  const { openNew } = usePrinterDialog();
  return (
    <Button onClick={openNew}>
      <Plus size={16} aria-hidden="true" />
      {label}
    </Button>
  );
}

const TITLES: Record<Step, string> = {
  choose: "Adicionar máquina",
  catalog: "Escolher no catálogo",
  form: "Dados da máquina",
};

function Wizard({
  mode,
  catalogItems,
  onCatalogLoaded,
  onClose,
}: {
  mode: Mode;
  catalogItems: CatalogListItem[] | null;
  onCatalogLoaded: (items: CatalogListItem[]) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>(mode.kind === "edit" ? "form" : "choose");
  const [catalog, setCatalog] = useState<CatalogPrinterView | null>(null);

  const title = mode.kind === "edit" ? "Editar máquina" : TITLES[step];

  return (
    <div className="flex h-dvh flex-col">
      <div className="flex items-center justify-between border-b border-violeta/10 p-4 md:px-6">
        <h2 id="printer-dialog-title" className="text-lg font-extrabold">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="flex size-11 items-center justify-center rounded-xl hover:bg-nevoa"
          aria-label="Fechar"
        >
          <X size={20} />
        </button>
      </div>

      {step === "choose" && (
        <div className="space-y-3 p-4 md:p-6">
          <button
            type="button"
            onClick={() => setStep("catalog")}
            className="flex min-h-11 w-full items-start gap-3 rounded-xl border border-violeta/20 bg-white p-4 text-left shadow-sm transition-colors hover:bg-nevoa"
          >
            <BookOpen size={20} className="mt-0.5 shrink-0 text-violeta" aria-hidden="true" />
            <span>
              <span className="block font-semibold">Do catálogo</span>
              <span className="text-sm text-tinta/70">
                Escolha o modelo e os dados já vêm preenchidos.
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStep("form")}
            className="flex min-h-11 w-full items-start gap-3 rounded-xl border border-violeta/20 bg-white p-4 text-left shadow-sm transition-colors hover:bg-nevoa"
          >
            <PenLine size={20} className="mt-0.5 shrink-0 text-violeta" aria-hidden="true" />
            <span>
              <span className="block font-semibold">Outra máquina (manual)</span>
              <span className="text-sm text-tinta/70">
                Digite os dados da sua impressora.
              </span>
            </span>
          </button>
        </div>
      )}

      {step === "catalog" && (
        <>
          <CatalogPicker
            items={catalogItems}
            onLoaded={onCatalogLoaded}
            onSelect={(printer) => {
              setCatalog(printer);
              setStep("form");
            }}
          />
          <div className="border-t border-violeta/10 p-4 md:px-6">
            <Button variant="secondary" className="w-full" onClick={() => setStep("choose")}>
              Voltar
            </Button>
          </div>
        </>
      )}

      {step === "form" && (
        <PrinterForm
          printer={mode.kind === "edit" ? mode.printer : null}
          catalog={catalog}
          onDone={onClose}
          onCancel={onClose}
          onBack={
            mode.kind === "new"
              ? () => {
                  setCatalog(null);
                  setStep("choose");
                }
              : null
          }
        />
      )}
    </div>
  );
}

export function PrintersProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [formKey, setFormKey] = useState(0);
  // A lista do catálogo (só tipo, marca e modelo) é carregada uma vez.
  const [catalogItems, setCatalogItems] = useState<CatalogListItem[] | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // O dialog nativo cuida de Esc, foco preso e retorno do foco ao botão.
    if (mode && !dialog.open) dialog.showModal();
    if (!mode && dialog.open) dialog.close();
  }, [mode]);

  const open = useCallback((next: Mode) => {
    setFormKey((k) => k + 1);
    setMode(next);
  }, []);
  const close = useCallback(() => setMode(null), []);

  const api: PrinterDialogApi = {
    openNew: () => open({ kind: "new" }),
    openEdit: (printer) => open({ kind: "edit", printer }),
  };

  return (
    <PrinterDialogContext.Provider value={api}>
      {children}
      <dialog
        ref={dialogRef}
        aria-labelledby="printer-dialog-title"
        onClose={close}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-white p-0 text-tinta shadow-xl backdrop:bg-tinta/50 md:left-auto md:right-0 md:w-[30rem]"
      >
        {mode && (
          <Wizard
            key={formKey}
            mode={mode}
            catalogItems={catalogItems}
            onCatalogLoaded={setCatalogItems}
            onClose={close}
          />
        )}
      </dialog>
    </PrinterDialogContext.Provider>
  );
}
