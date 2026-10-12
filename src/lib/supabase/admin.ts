import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente com a service role key: ignora RLS. Só para código de servidor que precisa dele
// (cupons, criação da assinatura de teste). Nunca importar em componente de cliente e nunca
// usar prefixo NEXT_PUBLIC na variável.

export function hasAdminClient(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não está configurada no servidor.");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
