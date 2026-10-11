import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatBRL } from "@/lib/format";
import { getPrinters } from "@/lib/printers";
import { PRINTER_TYPE_LABEL } from "@/lib/printers-schema";
import { cn } from "@/lib/utils";
import type { TenantPrinter } from "@/types/database";
import { PrinterActions } from "./printer-actions";
import { AddPrinterButton, PrintersProvider } from "./printers-provider";

export const metadata = { title: "Máquinas | Voxa3D" };

// Desgaste por hora: preço dividido pela vida útil. Calculado só no servidor.
function wearPerHour(p: TenantPrinter): number | null {
  if (!p.price_brl || !p.lifespan_hours) return null;
  return p.price_brl / p.lifespan_hours;
}

function PrinterCard({ printer }: { printer: TenantPrinter }) {
  const wear = wearPerHour(printer);

  return (
    <Card className={cn("p-4", !printer.is_active && "opacity-70")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-extrabold leading-tight">
            {printer.nickname || printer.model}
          </p>
          <p className="text-sm text-tinta/70">
            {printer.nickname ? `${printer.brand} ${printer.model}` : printer.brand}
          </p>
        </div>
        <Badge>{PRINTER_TYPE_LABEL[printer.type]}</Badge>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-tinta/60">Consumo</dt>
          <dd className="font-semibold">
            {printer.power_w === null ? "-" : `${Math.round(printer.power_w)} W`}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-tinta/60">Preço</dt>
          <dd className="font-semibold">
            {printer.price_brl === null ? "-" : formatBRL(printer.price_brl)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-tinta/60">Desgaste por hora</dt>
          <dd className="font-semibold text-violeta">
            {wear === null ? "-" : `${formatBRL(wear)}/h`}
          </dd>
        </div>
      </dl>
      {wear === null && (
        <p className="mt-2 text-xs text-tinta/60">
          Preencha preço e vida útil para ver o desgaste por hora
        </p>
      )}

      <div className="mt-3">
        <PrinterActions printer={printer} />
      </div>
    </Card>
  );
}

export default async function MaquinasPage() {
  const printers = await getPrinters();
  const active = printers.filter((p) => p.is_active);
  const inactive = printers.filter((p) => !p.is_active);

  return (
    <PrintersProvider>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-tinta">Máquinas</h1>
            <p className="mt-1 text-sm text-tinta/70">
              As impressoras usadas nos seus orçamentos.
            </p>
          </div>
          {printers.length > 0 && <AddPrinterButton />}
        </div>

        {printers.length === 0 ? (
          <Card className="text-center">
            <p className="font-semibold">Cadastre sua primeira máquina</p>
            <p className="mt-1 text-sm text-tinta/70">
              Escolha no catálogo ou digite os dados da sua impressora.
            </p>
            <div className="mt-4 flex justify-center">
              <AddPrinterButton />
            </div>
          </Card>
        ) : (
          <>
            {active.length > 0 && (
              <ul className="grid gap-4 md:grid-cols-2">
                {active.map((p) => (
                  <li key={p.id}>
                    <PrinterCard printer={p} />
                  </li>
                ))}
              </ul>
            )}

            {inactive.length > 0 && (
              <details className="group rounded-xl">
                <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-violeta hover:text-violeta-escuro">
                  Inativas ({inactive.length})
                </summary>
                <ul className="mt-3 grid gap-4 md:grid-cols-2">
                  {inactive.map((p) => (
                    <li key={p.id}>
                      <PrinterCard printer={p} />
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>
    </PrintersProvider>
  );
}
