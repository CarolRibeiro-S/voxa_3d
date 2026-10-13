// Parâmetro de retorno (?next=) sem redirecionamento aberto: só caminhos internos.
export function safeNextPath(value: string | null | undefined, fallback = "/painel"): string {
  if (!value || value.length > 300) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  // Barra invertida, quebras de linha e caracteres de controle podem enganar o navegador.
  if (/[\\\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
