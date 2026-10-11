const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatBRL(value: number): string {
  return brl.format(value);
}

export function formatDate(value: Date | string | number): string {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

// Dias inteiros até a data (arredondado para cima). Negativo se já passou.
export function daysUntil(value: Date | string | number): number {
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
}

// 47.99 vira "47,99" e 30 vira "30" (até 2 casas, sem zeros sobrando).
export function formatPercent(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

// Máscara de valores em reais, estilo "centavos". Funções puras.

// 12345.67 com 2 casas vira "12.345,67".
export function formatMoneyDigits(value: number, decimals = 2): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  }).format(value);
}

// Texto digitado: só os dígitos contam, preenchendo da direita para a esquerda.
// "1,500" com 2 casas vira 15 (ou seja, "15,00"). Vazio vira 0.
export function parseMoneyDigits(text: string, decimals = 2): number {
  const digits = text.replace(/\D/g, "");
  if (digits === "" || digits.length > 15) return digits === "" ? 0 : NaN;
  return Number(digits) / 10 ** decimals;
}

// Texto colado: "12,50" e "R$ 1.250,00" são lidos como valor em reais.
// Vírgula ou ponto seguido de 1 até `decimals` dígitos no final é a parte
// decimal. Sem parte decimal, o número é tratado como reais inteiros.
export function parsePastedMoney(text: string, decimals = 2): number {
  const clean = text.replace(/[^\d.,]/g, "");
  const match = clean.match(new RegExp(`^(.*)[.,](\\d{1,${Math.max(decimals, 1)}})$`));
  const intPart = (match ? match[1] : clean).replace(/\D/g, "");
  const decPart = match ? match[2].padEnd(decimals, "0") : "";
  const digits = `${intPart || "0"}${decPart.padEnd(decimals, "0")}`;
  if (!/\d/.test(text) || digits.length > 15) return NaN;
  return Number(digits) / 10 ** decimals;
}
