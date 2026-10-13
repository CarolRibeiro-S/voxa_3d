// Tipos escritos à mão apenas para as tabelas usadas até agora.
import type { Plan } from "@/lib/plans";

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";
export type MemberRole = "owner" | "manager" | "operator";

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
  energy_distributor_id: string | null;
  energy_tariff_group: "B1" | "B3" | null;
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

// Retorno de public.energy_list_distributors(): lista de distribuidoras.
export interface EnergyDistributorRpcItem {
  id: string;
  name: string;
  state: string;
}

// Retorno de public.energy_get_tariff(p_distributor_id, p_group).
export interface EnergyTariffRpc {
  distributor_name: string;
  state: string;
  tariff_group: "B1" | "B3";
  kwh_brl: number;
  valid_to: string | null;
  expired: boolean;
  estimated_taxes: boolean;
}

export interface SalesChannel {
  id: string;
  tenant_id: string;
  name: string;
  commission_pct: number;
  payment_pct: number;
  tax_pct: number;
  fixed_fee_brl: number;
  is_active: boolean;
  position: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type SalesChannelInsert = Pick<
  SalesChannel,
  | "tenant_id"
  | "name"
  | "commission_pct"
  | "payment_pct"
  | "tax_pct"
  | "fixed_fee_brl"
  | "is_active"
  | "position"
>;

export type OrderKind = "client" | "stock";
export type OrderStatus = "placed" | "printing" | "ready" | "shipped" | "delivered" | "canceled";
export type PaymentStatus = "pending" | "paid";

// number, total e status_changed_at são mantidos pelo banco (gatilhos): nunca enviar number nem
// total no insert. Sem permissão de delete.
export interface Order {
  id: string;
  tenant_id: string;
  number: number;
  kind: OrderKind;
  status: OrderStatus;
  client_name: string | null;
  client_phone: string | null;
  due_date: string | null;
  payment_status: PaymentStatus;
  paid_at: string | null;
  tracking_code: string | null;
  notes: string | null;
  quote_id: string | null;
  total: number;
  status_changed_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type OrderInsert = Pick<Order, "tenant_id" | "kind"> &
  Partial<
    Pick<
      Order,
      | "status"
      | "client_name"
      | "client_phone"
      | "due_date"
      | "payment_status"
      | "paid_at"
      | "tracking_code"
      | "notes"
      | "quote_id"
    >
  >;

export interface OrderItem {
  id: string;
  tenant_id: string;
  order_id: string;
  // Item do orçamento de onde veio (nulo nos itens manuais).
  quote_item_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  deleted_at: string | null;
  created_at: string;
}

// Itens do pedido nunca guardam calc_input nem calc_result. created_at é enviado de propósito:
// os itens de um mesmo pedido são ordenados por created_at e depois por id.
export type OrderItemInsert = Pick<
  OrderItem,
  "tenant_id" | "order_id" | "description" | "quantity" | "unit_price" | "line_total" | "created_at"
> & { quote_item_id?: string | null };

// Convite para entrar em uma loja. Só o hash do token é guardado, nunca o token.
export interface TenantInvite {
  id: string;
  tenant_id: string;
  email: string;
  role: "manager" | "operator";
  token_hash: string;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  revoked_at: string | null;
  created_at: string;
}
