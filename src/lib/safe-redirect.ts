// Parâmetro de retorno (?next=) sem redirecionamento aberto: só caminhos internos.
export function safeNextPath(value: string | null | undefined, fallback = "/painel"): string {
  if (!value || value.length > 300) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  // Barra invertida, quebras de linha e caracteres de controle podem enganar o navegador.
  if (/[\\\u0000-\u001f]/.test(value)) return fallback;
  return value;
}

// Endereço de retorno dos e-mails e do login social: sempre a origem onde a pessoa está.
// NEXT_PUBLIC_SITE_URL só entra quando não há origem disponível (por exemplo, fora do navegador).
// O next é revalidado aqui, então só caminhos internos chegam ao link.
export function authCallbackUrl(next: string | null | undefined, origin?: string | null): string {
  const base = (origin || process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "");
  return `${base}/auth/callback?next=${encodeURIComponent(safeNextPath(next))}`;
}
