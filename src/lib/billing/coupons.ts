import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Cupons. A consulta usa a service role (só no servidor) e devolve apenas o tipo e o extra.
// Colunas de coupons (migration 017): id, code, kind (launch ou referral), referrer_name,
// extra_discount_pct, commission_pct, commission_recurring, active, created_at.
// Aqui só são lidas kind, extra_discount_pct e active.

export interface CouponInfo {
  kind: "launch" | "referral";
  extraPct: number;
}

const CODE_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

export function normalizeCouponCode(raw: string): string | null {
  const code = raw.trim();
  return CODE_PATTERN.test(code) ? code : null;
}

// Escapa os curingas do ilike para a comparação ser exata, sem diferenciar maiúsculas.
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function findCoupon(raw: string): Promise<CouponInfo | null> {
  const code = normalizeCouponCode(raw);
  if (!code) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("coupons")
    .select("kind, extra_discount_pct, active")
    .ilike("code", escapeLike(code))
    .limit(1);
  if (error) {
    console.error("Erro ao consultar cupom:", error.code, error.message);
    throw new Error("Falha na consulta de cupom");
  }

  const row = data?.[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  // Só cupom ativo vale.
  if (row.active !== true) return null;
  if (row.kind !== "launch" && row.kind !== "referral") return null;

  const extra = Number(row.extra_discount_pct ?? 0);
  return {
    kind: row.kind,
    extraPct: row.kind === "referral" && Number.isFinite(extra) && extra > 0 ? extra : 0,
  };
}

// Limite de tentativas contra força bruta de códigos, controlado pelo banco (função
// coupon_rate_check, migration 022): 20 consultas a cada 10 minutos por chave. A chave é
// "u:" + id do usuário, ou "ip:" + IP quando a pessoa não está logada.
const COUPON_ATTEMPT_LIMIT = 20;

// true = pode continuar. Se a chamada falhar, bloqueia (falha segura) e registra o erro.
export async function couponAttemptAllowed(key: string): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().rpc("coupon_rate_check", {
      p_key: key,
      p_limit: COUPON_ATTEMPT_LIMIT,
    });
    if (error) {
      console.error("Erro em coupon_rate_check:", error.code, error.message);
      return false;
    }
    return data === true;
  } catch (error) {
    console.error("Erro ao verificar o limite de cupons:", error instanceof Error ? error.message : "desconhecido");
    return false;
  }
}
