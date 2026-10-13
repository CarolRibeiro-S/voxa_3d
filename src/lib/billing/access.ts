import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccessNotice, AccessStatus, ReadOnlyReason } from "@/lib/billing/access-types";
import { normalizePlan, type Plan } from "@/lib/plans";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import type { Tenant } from "@/types/database";

// Estado de acesso da conta: teste de 7 dias, assinatura ativa ou modo leitura.
//
// Os nomes de colunas abaixo são a fonte da verdade; confira a Carol antes de criar colunas novas.
//
// Pedidos (migration 018):
// orders:      id, tenant_id, number (gatilho), kind ('client' ou 'stock'), status ('placed',
//              'printing','ready','shipped','delivered','canceled'), quote_id, client_name,
//              client_phone, due_date, payment_status ('pending' ou 'paid'), paid_at, tracking_code,
//              notes, total (gatilho: nunca gravar), status_changed_at, deleted_at, created_at,
//              updated_at
// order_items: id, tenant_id, order_id, quote_item_id (nullable), description, quantity,
//              unit_price, line_total (gravável), deleted_at, created_at (sem position)
//
// Billing (migration 017). Não adivinhar nomes: conferir esta lista.
//
// plans:         code, name, monthly_price_cents, active
// plan_periods:  code, months, discount_pct, launch_discount_pct, sort_order
// launch_config: id (boolean, linha única), quota, price_months, reservation_minutes, active
//                (não existe lock_months: a duração do preço de lançamento é price_months)
// coupons:       id, code, kind (launch ou referral), referrer_name, extra_discount_pct,
//                commission_pct, commission_recurring, active, created_at
//                (não existem expires_at nem is_active: só active)
// subscriptions: id, tenant_id (unique), plan_code (obrigatório), period_code (NULLABLE, nulo
//                durante o teste), status (trialing, pending_payment, active, past_due, canceled,
//                expired), trial_ends_at, current_period_end, list_price_cents,
//                charged_price_cents, discount_pct_applied, launch_coupon_id, referral_coupon_id,
//                promo_price_until, mp_preapproval_id, created_at, updated_at

export const TRIAL_DAYS = 7;
// Dias de carência depois do fim do período pago (pagamento atrasado ou rede de segurança).
export const GRACE_DAYS_PAST_DUE = 3;

export type { AccessStatus };

export interface Access {
  plan: Plan;
  status: AccessStatus;
  trialEndsAt: string | null;
  // Modo leitura: a pessoa vê os dados mas não cria nem edita nada.
  readOnly: boolean;
  // Mensagem mostrada quando uma gravação é recusada (só em modo leitura).
  message: string | null;
  // Aviso da faixa do topo (pagamento pendente, cancelamento, modo leitura).
  notice: AccessNotice | null;
  // "fallback": não foi possível ler nem criar a assinatura (só em desenvolvimento).
  source: "subscription" | "fallback";
}

export const READ_ONLY_MESSAGE = "Seu teste grátis terminou. Assine para continuar editando.";
export const VERIFY_FAILED_MESSAGE =
  "Não foi possível verificar sua assinatura agora. Tente novamente em instantes.";
const INACTIVE_MESSAGE = "Sua assinatura não está ativa. Regularize para continuar editando.";

const READ_ONLY_MESSAGES: Record<ReadOnlyReason, string> = {
  trial_ended: READ_ONLY_MESSAGE,
  expired: INACTIVE_MESSAGE,
  canceled: INACTIVE_MESSAGE,
  past_due: INACTIVE_MESSAGE,
  pending_payment: INACTIVE_MESSAGE,
  verify: VERIFY_FAILED_MESSAGE,
};

export interface SubscriptionRow {
  status: string | null;
  plan_code: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
}

const DAY_MS = 86_400_000;
const SELECT_COLUMNS = "status, plan_code, trial_ends_at, current_period_end";

function toRow(raw: Record<string, unknown> | null): SubscriptionRow | null {
  if (!raw) return null;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  return {
    status: str(raw.status),
    plan_code: str(raw.plan_code),
    trial_ends_at: str(raw.trial_ends_at),
    current_period_end: str(raw.current_period_end),
  };
}

function readOnlyAccess(
  plan: Plan,
  trialEndsAt: string | null,
  reason: ReadOnlyReason,
  source: Access["source"] = "subscription",
): Access {
  return {
    plan,
    status: "readonly",
    trialEndsAt,
    readOnly: true,
    message: READ_ONLY_MESSAGES[reason],
    notice: { kind: "readonly", reason },
    source,
  };
}

// Regras de acesso por status. Função pura: `now` em milissegundos.
//
// trialing: completo até trial_ends_at; depois, modo leitura.
// active: completo; se current_period_end passou há mais de GRACE_DAYS_PAST_DUE dias, leitura.
// past_due: completo até current_period_end + carência, com aviso; depois, leitura.
// pending_payment: mantém o acesso do teste (trial_ends_at futuro) ou do período pago
//   (current_period_end futuro); senão, leitura.
// canceled: completo até current_period_end (já pago); depois, leitura.
// expired (e qualquer status desconhecido): leitura.
export function computeAccess(row: SubscriptionRow, now: number): Access {
  const plan = normalizePlan(row.plan_code);
  const time = (iso: string | null) => (iso ? new Date(iso).getTime() : null);
  const trialEnd = time(row.trial_ends_at);
  const periodEnd = time(row.current_period_end);
  const grace = GRACE_DAYS_PAST_DUE * DAY_MS;

  const full = (status: AccessStatus, notice: AccessNotice | null): Access => ({
    plan,
    status,
    trialEndsAt: row.trial_ends_at,
    readOnly: false,
    message: null,
    notice,
    source: "subscription",
  });
  const blocked = (reason: ReadOnlyReason) => readOnlyAccess(plan, row.trial_ends_at, reason);

  switch (row.status) {
    case "trialing":
      return trialEnd !== null && trialEnd > now ? full("trialing", null) : blocked("trial_ended");
    case "active":
      return periodEnd !== null && now > periodEnd + grace ? blocked("expired") : full("active", null);
    case "past_due": {
      if (periodEnd === null || now > periodEnd + grace) return blocked("past_due");
      return full("active", {
        kind: "past_due",
        graceUntil: new Date(periodEnd + grace).toISOString(),
      });
    }
    case "pending_payment": {
      const keepsTrial = trialEnd !== null && trialEnd > now;
      const keepsPaid = periodEnd !== null && periodEnd > now;
      if (!keepsTrial && !keepsPaid) return blocked("pending_payment");
      return full(keepsPaid ? "active" : "trialing", { kind: "pending_payment" });
    }
    case "canceled":
      if (periodEnd !== null && periodEnd > now) {
        return full("active", { kind: "canceled", until: new Date(periodEnd).toISOString() });
      }
      return blocked("canceled");
    default:
      return blocked("expired");
  }
}

const isProduction = () => process.env.NODE_ENV === "production";

// Em produção, sem conseguir verificar a assinatura, a conta fica em modo leitura (falha segura).
function verifyFailed(tenant: Tenant, detail: string): Access {
  console.error(`Assinatura não verificada (${detail}).`);
  return readOnlyAccess(normalizePlan(tenant.plan), tenant.trial_ends_at, "verify", "fallback");
}

// Cria a assinatura de teste de forma idempotente (tenant_id é único). Só o servidor escreve.
async function createTrial(tenantId: string): Promise<SubscriptionRow | null> {
  const admin = createAdminClient();
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * DAY_MS).toISOString();
  // No teste o período ainda não foi escolhido: period_code fica nulo.
  const { error } = await admin
    .from("subscriptions")
    .upsert(
      {
        tenant_id: tenantId,
        plan_code: "pro",
        period_code: null,
        status: "trialing",
        trial_ends_at: trialEndsAt,
      },
      { onConflict: "tenant_id", ignoreDuplicates: true },
    );
  if (error) {
    console.error("Erro ao criar a assinatura de teste:", error.code, error.message);
    return null;
  }

  // Relê, porque outra requisição pode ter criado antes (a linha existente vale).
  const { data } = await admin
    .from("subscriptions")
    .select(SELECT_COLUMNS)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return toRow(data as Record<string, unknown> | null);
}

export async function resolveAccess(supabase: SupabaseClient, tenant: Tenant): Promise<Access> {
  // Produção sem a chave de serviço: não dá para criar nem confirmar assinaturas.
  if (isProduction() && !hasAdminClient()) return verifyFailed(tenant, "chave de serviço ausente");

  const { data, error } = await supabase
    .from("subscriptions")
    .select(SELECT_COLUMNS)
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (error) {
    console.error("Erro ao ler a assinatura:", error.code, error.message);
  } else {
    let row = toRow(data as Record<string, unknown> | null);
    if (!row && hasAdminClient()) row = await createTrial(tenant.id);
    if (row) return computeAccess(row, Date.now());
  }

  if (isProduction()) return verifyFailed(tenant, "leitura e criação falharam");

  // Desenvolvimento: libera o acesso, com aviso no console.
  console.error("Assinatura não verificada: em desenvolvimento o acesso foi liberado.");
  return {
    plan: normalizePlan(tenant.plan),
    status: "trialing",
    trialEndsAt: tenant.trial_ends_at,
    readOnly: false,
    message: null,
    notice: null,
    source: "fallback",
  };
}
