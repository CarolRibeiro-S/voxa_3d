const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatBRL(value: number): string {
  return brl.format(value);
}

export function formatDate(value: Date | string | number): string {
  // "2026-10-18" (só data) é lido como dia local, para não recuar um dia por fuso horário.
  const plain = typeof value === "string" ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  const date = plain ? new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3])) : new Date(value);
  return new Intl.DateTimeFormat("pt-BR").format(date);
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

// Ignora tudo que não for dígito: "(11) 91234-5678" vira "11912345678".
export function normalizePhoneDigits(input: string): string {
  return input.replace(/\D/g, "");
}

// Parte nacional (DDD + número) de um telefone só com dígitos, ou null se o tamanho não bate.
// 10 ou 11 dígitos são nacionais. 12 ou 13 dígitos precisam começar com 55.
function nationalPart(digits: string): string | null {
  if (digits.length === 10 || digits.length === 11) return digits;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    return digits.slice(2);
  }
  return null;
}

const PHONE_FORMAT_ERROR = "Informe o WhatsApp com DDD. Ex.: (61) 99999-0000";
const PHONE_MISSING_NINE_ERROR = "Parece faltar o 9 do celular. Confira o número.";

// Mensagem de erro de um telefone brasileiro só com dígitos, ou null se for válido.
export function brPhoneError(digits: string): string | null {
  const national = nationalPart(digits);
  if (national === null) return PHONE_FORMAT_ERROR;
  // DDD: dois dígitos, de 11 a 99, sem zero à esquerda.
  if (Number(national.slice(0, 2)) < 11) return PHONE_FORMAT_ERROR;
  const third = national[2];
  if (national.length === 11) return third === "9" ? null : PHONE_FORMAT_ERROR;
  // 10 dígitos: fixo começa com 2 a 5. Começando com 6 a 9, provavelmente falta o 9 do celular.
  if (/[2-5]/.test(third)) return null;
  return /[6-9]/.test(third) ? PHONE_MISSING_NINE_ERROR : PHONE_FORMAT_ERROR;
}

export function isValidBrPhone(digits: string): boolean {
  return brPhoneError(digits) === null;
}

// 11912345678 vira "(11) 91234-5678". Com 55 na frente (12 ou 13 dígitos), vira "+55 (11) 91234-5678".
export function formatPhone(value: string): string {
  const digits = normalizePhoneDigits(value);
  const national = digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
  const prefix = national === digits ? "" : "+55 ";
  if (national.length === 0) return "";
  if (national.length <= 2) return `${prefix}(${national}`;
  const area = national.slice(0, 2);
  const rest = national.slice(2);
  const split = national.length > 10 ? 5 : 4;
  if (rest.length <= split) return `${prefix}(${area}) ${rest}`;
  return `${prefix}(${area}) ${rest.slice(0, split)}-${rest.slice(split)}`;
}

// Contato do cliente é texto livre. Se for só um telefone brasileiro válido, formata. Senão, mostra como está.
export function formatContact(value: string): string {
  if (/[@\p{L}]/u.test(value)) return value;
  const stripped = value.replace(/[\s()+-]/g, "");
  if (/^\d+$/.test(stripped) && isValidBrPhone(stripped)) return formatPhone(stripped);
  return value;
}

// "11/10/2026 14:30", sempre no fuso de São Paulo.
export function formatDateTime(value: Date | string | number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

// 1.1023 vira "R$ 1,1023" (sempre quatro casas decimais).
export function formatKwh(value: number): string {
  return `R$ ${formatMoneyDigits(value, 4)}`;
}
