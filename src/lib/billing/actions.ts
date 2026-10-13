"use server";

import { headers } from "next/headers";
import { couponAttemptAllowed, findCoupon, type CouponInfo } from "@/lib/billing/coupons";
import { buildPriceGrid, type PriceGrid } from "@/lib/billing/grid";
import { getLaunchLevel } from "@/lib/billing/launch";
import { getBillingCatalog } from "@/lib/billing/plans";
import { getCurrentUser } from "@/lib/tenant";

export type BillingActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const INVALID_COUPON = "Cupom inválido ou indisponível";
const LAUNCH_SOLD_OUT = "As vagas de lançamento acabaram";
const TOO_MANY = "Muitas tentativas. Tente novamente em alguns minutos.";
const GENERIC = "Não foi possível concluir agora. Tente novamente.";

// Quem consulta: "u:" + id do usuário logado ou, sem login, "ip:" + primeiro IP de x-forwarded-for.
async function callerKey(): Promise<string> {
  const user = await getCurrentUser();
  if (user) return `u:${user.id}`;
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `ip:${forwarded || "desconhecido"}`;
}

// Confere o cupom. Cupom de lançamento só confirma que ainda há vaga: a vaga NÃO é reservada aqui.
export async function validateCoupon(code: string): Promise<BillingActionResult<CouponInfo>> {
  if (typeof code !== "string") return { ok: false, error: INVALID_COUPON };
  if (!(await couponAttemptAllowed(await callerKey()))) return { ok: false, error: TOO_MANY };

  try {
    const coupon = await findCoupon(code);
    if (!coupon) return { ok: false, error: INVALID_COUPON };
    if (coupon.kind === "launch") {
      const level = await getLaunchLevel();
      if (level === "soldout") return { ok: false, error: LAUNCH_SOLD_OUT };
      // Sem saber se ainda há vaga, não confirma o cupom de lançamento.
      if (level === "hidden") return { ok: false, error: GENERIC };
    }
    return { ok: true, data: { kind: coupon.kind, extraPct: coupon.extraPct } };
  } catch (error) {
    console.error("Erro ao validar cupom:", error instanceof Error ? error.message : "desconhecido");
    return { ok: false, error: INVALID_COUPON };
  }
}

// Recalcula a tabela de preços no servidor com os cupons informados. O navegador nunca decide
// valor: os códigos são conferidos de novo aqui.
export async function getPriceGrid(codes: string[]): Promise<BillingActionResult<PriceGrid>> {
  const list = Array.isArray(codes) ? codes.filter((c) => typeof c === "string").slice(0, 2) : [];

  try {
    const catalog = await getBillingCatalog();
    let launch = false;
    let referralExtraPct = 0;
    let referralSeen = false;
    let launchSeen = false;

    if (list.length > 0) {
      if (!(await couponAttemptAllowed(await callerKey()))) return { ok: false, error: TOO_MANY };
      for (const code of list) {
        const coupon = await findCoupon(code);
        if (!coupon) return { ok: false, error: INVALID_COUPON };
        // No máximo um cupom de lançamento e um de indicação.
        if (coupon.kind === "launch") {
          if (launchSeen) return { ok: false, error: "Use apenas um cupom de lançamento." };
          launchSeen = true;
          const level = await getLaunchLevel();
          if (level === "soldout") return { ok: false, error: LAUNCH_SOLD_OUT };
          if (level === "hidden") return { ok: false, error: GENERIC };
          launch = true;
        } else {
          if (referralSeen) return { ok: false, error: "Use apenas um cupom de indicação." };
          referralSeen = true;
          referralExtraPct = coupon.extraPct;
        }
      }
    }
    return { ok: true, data: buildPriceGrid(catalog, launch, referralExtraPct) };
  } catch (error) {
    console.error("Erro ao calcular preços:", error instanceof Error ? error.message : "desconhecido");
    return { ok: false, error: GENERIC };
  }
}
