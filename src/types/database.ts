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
