import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePlan, type Plan } from "@/lib/plans";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import type { Tenant } from "@/types/database";

// Estado de acesso da conta: teste de 7 dias, assinatura ativa ou modo leitura.
// Nomes de colunas usados em subscriptions: tenant_id, status, plan_code, trial_ends_at.

export const TRIAL_DAYS = 7;

export type AccessStatus = "trialing" | "active" | "readonly";

export interface Access {
  plan: Plan;
  status: AccessStatus;
  trialEndsAt: string | null;
  // Modo leitura: a pessoa vê os dados mas não cria nem edita nada.
  readOnly: boolean;
  // "fallback": não foi possível ler nem criar a assinatura. Nesse caso nada é bloqueado.
  source: "subscription" | "fallback";
}

export const READ_ONLY_MESSAGE = "Seu teste grátis terminou. Assine para continuar editando.";

interface SubscriptionRow {
  status: string | null;
  plan_code: string | null;
  trial_ends_at: string | null;
}

function toRow(raw: Record<string, unknown> | null): SubscriptionRow | null {
  if (!raw) return null;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  return {
    status: str(raw.status),
    plan_code: str(raw.plan_code),
    trial_ends_at: str(raw.trial_ends_at),
  };
}

function fromRow(row: SubscriptionRow): Access {
  const plan = normalizePlan(row.plan_code);
  const trialEnds = row.trial_ends_at ? new Date(row.trial_ends_at).getTime() : null;

  if (row.status === "active") {
    return { plan, status: "active", trialEndsAt: row.trial_ends_at, readOnly: false, source: "subscription" };
  }
  if (row.status === "trialing" && trialEnds !== null && trialEnds > Date.now()) {
    return { plan, status: "trialing", trialEndsAt: row.trial_ends_at, readOnly: false, source: "subscription" };
  }
  // Teste vencido sem assinatura ativa (ou assinatura cancelada): modo leitura. Nada é apagado.
  return { plan, status: "readonly", trialEndsAt: row.trial_ends_at, readOnly: true, source: "subscription" };
}

let warnedMissingKey = false;

// Cria a assinatura de teste de forma idempotente (tenant_id é único). Só o servidor escreve.
async function createTrial(tenantId: string): Promise<SubscriptionRow | null> {
  if (!hasAdminClient()) {
    if (!warnedMissingKey) {
      warnedMissingKey = true;
      console.error(
        "SUPABASE_SERVICE_ROLE_KEY não configurada: o teste de 7 dias não pode ser criado e o modo leitura não é aplicado.",
      );
    }
    return null;
  }

  const admin = createAdminClient();
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString();
  const { error } = await admin
    .from("subscriptions")
    .upsert(
      { tenant_id: tenantId, status: "trialing", plan_code: "pro", trial_ends_at: trialEndsAt },
      { onConflict: "tenant_id", ignoreDuplicates: true },
    );
  if (error) {
    console.error("Erro ao criar a assinatura de teste:", error.code, error.message);
    return null;
  }

  // Relê, porque outra requisição pode ter criado antes (a linha existente vale).
  const { data } = await admin
    .from("subscriptions")
    .select("status, plan_code, trial_ends_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return toRow(data as Record<string, unknown> | null);
}

export async function resolveAccess(supabase: SupabaseClient, tenant: Tenant): Promise<Access> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, plan_code, trial_ends_at")
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (error) {
    console.error("Erro ao ler a assinatura:", error.code, error.message);
  } else {
    const row = toRow(data as Record<string, unknown> | null) ?? (await createTrial(tenant.id));
    if (row) return fromRow(row);
  }

  // Sem assinatura legível: usa o plano da conta e não bloqueia nada.
  return {
    plan: normalizePlan(tenant.plan),
    status: "trialing",
    trialEndsAt: tenant.trial_ends_at,
    readOnly: false,
    source: "fallback",
  };
}
