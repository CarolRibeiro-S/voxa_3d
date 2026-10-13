import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { getMaterials } from "@/lib/materials";
import { hasFeature } from "@/lib/plans";
import { getPrinters } from "@/lib/printers";
import { getCostSettings, getCurrentTenant } from "@/lib/tenant";
import { FdmCalculator, type SelectOption } from "./fdm-calculator";
import { guardPage } from "@/lib/permissions-server";

export const metadata = { title: "Calculadora FDM | Voxa3D" };

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold text-tinta">Calculadora FDM</h1>
      <p className="mt-1 text-sm text-tinta/70">
        Informe a máquina, os materiais e o tempo para ver o preço sugerido.
      </p>
    </div>
  );
}

export default async function CalculadoraFdmPage() {
  const current = await getCurrentTenant();
  if (!current) return null; // O layout já mostra o erro de conta.
  guardPage(current.role, "use_calculators");
  const { tenant } = current;

  // Teste vencido sem assinatura: a calculadora fica indisponível até assinar.
  if (current.access.readOnly) redirect("/assinatura");

  if (!hasFeature(tenant.plan, "calculator")) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Header />
        <Card>
          <p className="text-sm text-tinta/70">
            A calculadora não está disponível no seu plano.
          </p>
        </Card>
      </div>
    );
  }

  const [printers, materials, settings] = await Promise.all([
    getPrinters(),
    getMaterials("filament", false),
    getCostSettings(tenant.id),
  ]);

  const printerOptions: SelectOption[] = printers
    .filter((p) => p.is_active && p.type === "fdm")
    .map((p) => ({ id: p.id, label: `${p.nickname || p.model} (${p.brand})` }));

  const materialOptions: SelectOption[] = materials
    .filter((m) => m.is_active)
    .map((m) => ({
      id: m.id,
      label: [m.name, m.brand, m.color].filter(Boolean).join(" · "),
    }));

  const missing: { text: string; href: string; action: string }[] = [];
  if (printerOptions.length === 0) {
    missing.push({
      text: "Cadastre uma máquina FDM ativa.",
      href: "/maquinas",
      action: "Ir para Máquinas",
    });
  }
  if (materialOptions.length === 0) {
    missing.push({
      text: "Cadastre um filamento ativo.",
      href: "/materiais",
      action: "Ir para Materiais",
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Header />

      {missing.length > 0 ? (
        <Card className="text-center">
          <p className="font-semibold">Falta pouco para calcular</p>
          <ul className="mt-2 space-y-1 text-sm text-tinta/70">
            {missing.map((m) => (
              <li key={m.href}>{m.text}</li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {missing.map((m) => (
              <Link key={m.href} href={m.href} className={buttonClasses({})}>
                {m.action}
              </Link>
            ))}
          </div>
        </Card>
      ) : !settings ? (
        <Card>
          <p className="text-sm text-tinta/70">
            Não encontramos as configurações de custo da sua conta.
          </p>
          <Link href="/configuracoes" className={`${buttonClasses({})} mt-4`}>
            Ir para Configurações
          </Link>
        </Card>
      ) : (
        <FdmCalculator
          printers={printerOptions}
          materials={materialOptions}
          defaults={{
            packaging_default_brl: settings.packaging_default_brl,
            default_margin_pct: Math.round(settings.default_margin_pct),
          }}
        />
      )}
    </div>
  );
}
