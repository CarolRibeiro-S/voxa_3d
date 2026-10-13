import Link from "next/link";
import { getMaterials } from "@/lib/materials";
import type { MaterialKind } from "@/types/database";
import { cn } from "@/lib/utils";
import { AutoTour } from "@/components/tour/tour-provider";
import { MaterialsView } from "./materials-view";
import { guardPage } from "@/lib/permissions-server";
import { getCurrentTenant } from "@/lib/tenant";

export const metadata = { title: "Materiais | Voxa3D" };

const TABS: { slug: "filamentos" | "resinas"; kind: MaterialKind; label: string }[] = [
  { slug: "filamentos", kind: "filament", label: "Filamentos" },
  { slug: "resinas", kind: "resin", label: "Resinas" },
];

export default async function MateriaisPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; arquivados?: string }>;
}) {
  const current = await getCurrentTenant();
  if (!current) return null; // O layout já mostra o erro de conta.
  guardPage(current.role, "view_catalog");
  const params = await searchParams;
  const tab = TABS.find((t) => t.slug === params.tipo) ?? TABS[0];
  const includeArchived = params.arquivados === "1";

  const materials = await getMaterials(tab.kind, includeArchived);

  const href = (slug: string, archived: boolean) =>
    `/materiais?tipo=${slug}${archived ? "&arquivados=1" : ""}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-tinta">Materiais</h1>
        <p className="mt-1 text-sm text-tinta/70">
          Filamentos e resinas usados nos seus orçamentos.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Tipo de material" data-tour="materiais-tipos" className="flex gap-2">
          {TABS.map((t) => (
            <Link
              key={t.slug}
              href={href(t.slug, includeArchived)}
              aria-current={t.slug === tab.slug ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold transition-colors",
                t.slug === tab.slug
                  ? "bg-violeta text-white"
                  : "bg-white text-tinta hover:bg-nevoa",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <Link
          href={href(tab.slug, !includeArchived)}
          className="flex min-h-11 py-2 leading-tight items-center gap-2 rounded-xl px-3 text-sm font-medium text-violeta hover:text-violeta-escuro"
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex size-5 items-center justify-center rounded border text-xs",
              includeArchived
                ? "border-violeta bg-violeta text-white"
                : "border-tinta/30 bg-white",
            )}
          >
            {includeArchived ? "✓" : ""}
          </span>
          Mostrar arquivados
        </Link>
      </div>

      <MaterialsView key={tab.kind} kind={tab.kind} materials={materials} />
      <AutoTour id="materiais" />
    </div>
  );
}
