// Tipos escritos à mão apenas para as tabelas usadas até agora.
import type { Plan } from "@/lib/plans";

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";
export type MemberRole = "owner" | "admin" | "member";

export interface Tenant {
  id: string;
  name: string;
  plan: Plan;
  subscription_status: SubscriptionStatus;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantMember {
  tenant_id: string;
  user_id: string;
  role: MemberRole;
  permissions: Record<string, unknown>;
}

// Colunas numeric chegam como número ou texto do PostgREST, por isso
// getCostSettings converte tudo com Number().
export interface CostSettings {
  tenant_id: string;
  energy_kwh_brl: number;
  labor_hour_brl: number;
  failure_rate_pct: number;
  default_margin_pct: number;
  marketplace_fee_pct: number;
  payment_fee_pct: number;
  tax_pct: number;
  packaging_default_brl: number;
  updated_at: string;
}

export type MaterialKind = "filament" | "resin";

// cost_per_unit é uma coluna gerada (price_brl / package_size): só leitura.
export interface Material {
  id: string;
  tenant_id: string;
  kind: MaterialKind;
  name: string;
  brand: string | null;
  material_type: string | null;
  color: string | null;
  price_brl: number;
  package_size: number;
  cost_per_unit: number;
  stock_remaining: number | null;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type PrinterType = "fdm" | "resin";

export interface TenantPrinter {
  id: string;
  tenant_id: string;
  catalog_id: string | null;
  nickname: string | null;
  type: PrinterType;
  brand: string;
  model: string;
  power_w: number | null;
  price_brl: number | null;
  lifespan_hours: number | null;
  maintenance_brl_per_hour: number;
  notes: string | null;
  is_active: boolean;
  // Preenchido quando a máquina está na Lixeira.
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type TenantPrinterInsert = Pick<
  TenantPrinter,
  "tenant_id" | "type" | "brand" | "model"
> &
  Partial<
    Omit<
      TenantPrinter,
      "id" | "created_at" | "updated_at" | "tenant_id" | "type" | "brand" | "model"
    >
  >;

export type TenantPrinterUpdate = Partial<
  Omit<TenantPrinter, "id" | "tenant_id" | "created_at">
>;

// Retorno de public.catalog_list_printers(): só tipo, marca e modelo.
export interface CatalogListRpcItem {
  type: PrinterType;
  brand: string;
  model: string;
}

export type PowerBasis = "fabricante" | "medicao" | "estimativa";

// Retorno de public.catalog_get_printer(p_brand, p_model), ou null.
export interface CatalogPrinterRpc {
  id: string;
  type: PrinterType;
  brand: string;
  model: string;
  build_x_mm: number | null;
  build_y_mm: number | null;
  build_z_mm: number | null;
  rated_power_w: number | null;
  avg_power_w: number | null;
  avg_power_basis: PowerBasis | null;
  enclosed: boolean | null;
  hardened_nozzle: boolean | null;
  multicolor: boolean | null;
  screen_size_in: number | null;
  price_ref_brl: number | null;
  price_ref_source: string | null;
  price_ref_date: string | null;
  notes: string | null;
}

export interface TenantProfile {
  tenant_id: string;
  business_name: string | null;
  whatsapp: string | null;
  instagram: string | null;
  updated_at: string;
}

export type QuoteStatus = "draft" | "sent" | "approved" | "declined";

// number é preenchido por gatilho e total_brl é mantido por gatilho: nunca gravar.
export interface Quote {
  id: string;
  tenant_id: string;
  number: number;
  customer_name: string;
  customer_contact: string | null;
  status: QuoteStatus;
  valid_until: string | null;
  notes: string | null;
  total_brl: number;
  approved_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type QuoteInsert = Pick<Quote, "tenant_id" | "customer_name"> &
  Partial<
    Omit<
      Quote,
      "id" | "tenant_id" | "customer_name" | "number" | "total_brl" | "created_at" | "updated_at"
    >
  >;

export type QuoteUpdate = Partial<
  Omit<Quote, "id" | "tenant_id" | "number" | "total_brl" | "created_at">
>;

export type QuoteItemKind = "fdm" | "resin" | "custom";

// calc_input e calc_result existem no banco, mas nunca são lidos pelo app em telas nem no PDF.
export interface QuoteItem {
  id: string;
  tenant_id: string;
  quote_id: string;
  position: number;
  kind: QuoteItemKind;
  description: string;
  quantity: number;
  suggested_unit_price_brl: number | null;
  unit_price_brl: number;
  deleted_at: string | null;
  created_at: string;
}

export type QuoteItemInsert = Pick<
  QuoteItem,
  "tenant_id" | "quote_id" | "position" | "kind" | "description" | "quantity" | "unit_price_brl"
> & {
  suggested_unit_price_brl?: number | null;
  calc_input?: unknown;
  calc_result?: unknown;
};

export type AuditAction = "create" | "update" | "delete" | "restore";

// Somente leitura para o usuário: a tabela é preenchida por gatilho no banco.
export interface AuditLogRow {
  id: string;
  tenant_id: string;
  actor_id: string | null;
  entity: string;
  entity_id: string;
  action: AuditAction;
  summary: string | null;
  changes: Record<string, { de: unknown; para: unknown }> | null;
  reverted_at: string | null;
  reverted_by: string | null;
  created_at: string;
}
