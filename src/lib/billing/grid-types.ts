// Tipos da tabela de preços, compartilhados com o cliente. Sem imports de servidor.

export interface QuoteView {
  listCents: number;
  chargedCents: number;
  pctApplied: number;
  perMonthCents: number;
  savedCents: number;
}

export interface PriceGrid {
  plans: { code: string; name: string }[];
  periods: { code: string; months: number; label: string }[];
  quotes: Record<string, Record<string, QuoteView>>;
  launchApplied: boolean;
  referralExtraPct: number;
  launchLockMonths: number;
}

