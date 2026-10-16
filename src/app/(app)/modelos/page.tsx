import { AutoTour } from "@/components/tour/tour-provider";
import { countModels, getMaxModels, getModels } from "@/lib/models-data";
import { can } from "@/lib/permissions";
import { guardPage } from "@/lib/permissions-server";
import { getCurrentTenant } from "@/lib/tenant";
import { ModelsView } from "./models-view";

export const metadata = { title: "Modelos | Voxa3D" };

export default async function ModelosPage() {
  const current = await getCurrentTenant();
  if (!current) return null; // O layout já mostra o erro de conta.
  guardPage(current.role, "view_models");

  let loaded: { models: Awaited<ReturnType<typeof getModels>>; max: number; used: number } | null = null;
  try {
    const [models, max, used] = await Promise.all([
      getModels(),
      getMaxModels(current.tenant.plan),
      countModels(current.tenant.id),
    ]);
    loaded = { models, max, used };
  } catch (error) {
    // Registra só a mensagem do erro, sem dados do usuário.
    console.error("Erro ao carregar modelos:", error instanceof Error ? error.message : "desconhecido");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-tinta">Modelos</h1>
        <p className="mt-1 text-sm text-tinta/70">
          Os desenhos que você imprime, com foto e observações de impressão.
        </p>
        <p data-tour="modelos-vinculo" className="mt-1 text-sm text-tinta/70">
          Ao criar um pedido ou um orçamento, escolha o modelo em cada item.
        </p>
      </div>

      {loaded === null ? (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          Não foi possível carregar os modelos agora. Tente novamente em instantes.
        </p>
      ) : (
        <ModelsView
          models={loaded.models}
          max={loaded.max}
          used={loaded.used}
          isPro={current.tenant.plan === "pro"}
          canManage={can(current.role, "manage_models")}
        />
      )}
      <AutoTour id="modelos" />
    </div>
  );
}
