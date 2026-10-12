"use server";

import type { CalcResult } from "@/lib/calc-types";
import { computeFdm } from "@/lib/calc/fdm";
import { fdmCalcSchema, type FdmCalcInput } from "@/lib/fdm-calc-schema";
import { hasFeature } from "@/lib/plans";
import { CALC_SESSION_ERROR, checkCalcLimit } from "@/lib/pricing-core";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant, getCurrentUser } from "@/lib/tenant";

export type CalculateFdmResult = CalcResult;

export async function calculateFdm(input: FdmCalcInput): Promise<CalculateFdmResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: CALC_SESSION_ERROR };

  // O tenant vem da sessão, nunca do formulário.
  const current = await getCurrentTenant();
  if (!current) return { ok: false, message: "Não encontramos a sua conta." };
  if (!hasFeature(current.tenant.plan, "calculator")) {
    return { ok: false, message: "A calculadora não está disponível no seu plano." };
  }

  // A entrada do cliente nunca é confiável: valida de novo no servidor.
  const parsed = fdmCalcSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Confira os valores informados.",
    };
  }

  // Cada cálculo conta no limite por hora. Checa antes de calcular.
  const supabase = await createClient();
  const limitMessage = await checkCalcLimit(supabase, "fdm");
  if (limitMessage) return { ok: false, message: limitMessage };

  return computeFdm(parsed.data);
}
