import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { formatBRL, formatDate, formatMoneyDigits, formatPercent, formatPhone } from "@/lib/format";
import { PRINTER_TYPE_LABEL } from "@/lib/printers-schema";
import { canTransition, isQuoteLocked, QUOTE_STATUS_LABEL, UUID_PATTERN } from "@/lib/quotes-schema";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant, getCurrentUser } from "@/lib/tenant";
import type { AuditAction, QuoteStatus } from "@/types/database";

// Histórico de alterações e Lixeira. O log é preenchido por gatilho no banco: o código só lê,
// e desfaz com UPDATE nas tabelas de negócio. Só campos de negócio visíveis ao dono passam daqui.

export type AuditEntity =
  | "tenant_printers"
  | "materials"
  | "quotes"
  | "quote_items"
  | "cost_settings"
  | "tenant_profile";

export type EntityGroup = "all" | "machines" | "materials" | "quotes" | "settings";

interface EntityInfo {
  label: string;
  article: "a" | "o" | "os";
  noun: string;
  group: Exclude<EntityGroup, "all">;
  // Tem deleted_at (Lixeira). cost_settings e tenant_profile não têm.
  softDelete: boolean;
  hasUpdatedAt: boolean;
  // Uma linha por conta (a chave é o tenant_id) em vez de uma linha por id.
  singleton: boolean;
  // Mostra o resumo (nome, número, cliente) na frase.
  showSummary: boolean;
}

export const ENTITIES: Record<AuditEntity, EntityInfo> = {
  tenant_printers: {
    label: "Máquina", article: "a", noun: "máquina", group: "machines",
    softDelete: true, hasUpdatedAt: true, singleton: false, showSummary: true,
  },
  materials: {
    label: "Material", article: "o", noun: "material", group: "materials",
    softDelete: true, hasUpdatedAt: true, singleton: false, showSummary: true,
  },
  quotes: {
    label: "Orçamento", article: "o", noun: "orçamento", group: "quotes",
    softDelete: true, hasUpdatedAt: true, singleton: false, showSummary: true,
  },
  quote_items: {
    label: "Item de orçamento", article: "o", noun: "item de orçamento", group: "quotes",
    softDelete: true, hasUpdatedAt: false, singleton: false, showSummary: true,
  },
  cost_settings: {
    label: "Custos e margens", article: "os", noun: "custos e margens", group: "settings",
    softDelete: false, hasUpdatedAt: true, singleton: true, showSummary: false,
  },
  tenant_profile: {
    label: "Dados do orçamento", article: "os", noun: "dados do orçamento", group: "settings",
    softDelete: false, hasUpdatedAt: true, singleton: true, showSummary: false,
  },
};

export const ENTITY_GROUPS: Record<EntityGroup, { label: string; entities: AuditEntity[] }> = {
  all: { label: "Todos", entities: Object.keys(ENTITIES) as AuditEntity[] },
  machines: { label: "Máquinas", entities: ["tenant_printers"] },
  materials: { label: "Materiais", entities: ["materials"] },
  quotes: { label: "Orçamentos", entities: ["quotes", "quote_items"] },
  settings: { label: "Configurações", entities: ["cost_settings", "tenant_profile"] },
};

const SOFT_DELETE_ENTITIES = (Object.keys(ENTITIES) as AuditEntity[]).filter(
  (e) => ENTITIES[e].softDelete,
);

type Kind = "text" | "int" | "number" | "brl" | "brl4" | "pct" | "date" | "status" | "bool" | "phone" | "printerType";

interface FieldSpec {
  label: string;
  kind: Kind;
  unit?: string;
  trueLabel?: string;
  falseLabel?: string;
}

const NUMERIC_KINDS: Kind[] = ["int", "number", "brl", "brl4", "pct"];

// Somente campos de negócio. Nunca entram ids, timestamps, valores gerados nem dados de cálculo.
export const ALLOWED_FIELDS: Record<AuditEntity, Record<string, FieldSpec>> = {
  tenant_printers: {
    type: { label: "Tipo", kind: "printerType" },
    brand: { label: "Marca", kind: "text" },
    model: { label: "Modelo", kind: "text" },
    nickname: { label: "Apelido", kind: "text" },
    power_w: { label: "Consumo médio", kind: "int", unit: "W" },
    price_brl: { label: "Preço da máquina", kind: "brl" },
    lifespan_hours: { label: "Vida útil", kind: "int", unit: "h" },
    maintenance_brl_per_hour: { label: "Manutenção por hora", kind: "brl", unit: "/hora" },
    notes: { label: "Observações", kind: "text" },
    is_active: { label: "Situação", kind: "bool", trueLabel: "Ativa", falseLabel: "Desativada" },
  },
  materials: {
    name: { label: "Nome", kind: "text" },
    brand: { label: "Marca", kind: "text" },
    material_type: { label: "Tipo de material", kind: "text" },
    color: { label: "Cor", kind: "text" },
    price_brl: { label: "Preço pago", kind: "brl" },
    package_size: { label: "Tamanho da embalagem", kind: "number" },
    stock_remaining: { label: "Estoque restante", kind: "number" },
    is_active: { label: "Situação", kind: "bool", trueLabel: "Ativo", falseLabel: "Arquivado" },
  },
  quotes: {
    customer_name: { label: "Nome do cliente", kind: "text" },
    customer_contact: { label: "Contato", kind: "text" },
    status: { label: "Status", kind: "status" },
    valid_until: { label: "Válido até", kind: "date" },
    notes: { label: "Observações", kind: "text" },
  },
  quote_items: {
    description: { label: "Descrição", kind: "text" },
    quantity: { label: "Quantidade", kind: "int" },
    unit_price_brl: { label: "Valor unitário", kind: "brl" },
  },
  cost_settings: {
    energy_kwh_brl: { label: "Energia", kind: "brl4", unit: "/kWh" },
    labor_hour_brl: { label: "Valor da sua hora de trabalho", kind: "brl", unit: "/hora" },
    packaging_default_brl: { label: "Embalagem padrão por pedido", kind: "brl" },
    failure_rate_pct: { label: "Taxa de falha", kind: "pct" },
    default_margin_pct: { label: "Margem de lucro desejada", kind: "pct" },
    marketplace_fee_pct: { label: "Taxa do marketplace", kind: "pct" },
    payment_fee_pct: { label: "Taxa de pagamento", kind: "pct" },
    tax_pct: { label: "Imposto sobre a venda", kind: "pct" },
  },
  tenant_profile: {
    business_name: { label: "Nome da empresa", kind: "text" },
    whatsapp: { label: "WhatsApp", kind: "phone" },
    instagram: { label: "Instagram", kind: "text" },
  },
};

const numberFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

function formatValue(spec: FieldSpec, value: unknown): string {
  if (value === null || value === undefined || value === "") return "vazio";
  const unit = spec.unit ?? "";
  switch (spec.kind) {
    case "brl":
      return `${formatBRL(Number(value))}${unit}`;
    case "brl4":
      return `R$ ${formatMoneyDigits(Number(value), 4)}${unit}`;
    case "pct":
      return `${formatPercent(Number(value))}%`;
    case "int":
    case "number":
      return `${numberFormat.format(Number(value))}${unit ? ` ${unit}` : ""}`;
    case "date":
      return formatDate(String(value));
    case "status":
      return QUOTE_STATUS_LABEL[value as QuoteStatus] ?? String(value);
    case "bool":
      return value === true ? (spec.trueLabel ?? "Sim") : (spec.falseLabel ?? "Não");
    case "phone":
      return formatPhone(String(value));
    case "printerType":
      return PRINTER_TYPE_LABEL[value as keyof typeof PRINTER_TYPE_LABEL] ?? String(value);
    default:
      return String(value);
  }
}

const toNumber = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
const toText = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

// Compara o valor atual do banco com o registrado, respeitando o tipo do campo.
function sameValue(spec: FieldSpec, a: unknown, b: unknown): boolean {
  if (NUMERIC_KINDS.includes(spec.kind)) return toNumber(a) === toNumber(b);
  if (spec.kind === "bool") return a === b;
  return toText(a) === toText(b);
}

const changesSchema = z.record(z.string(), z.object({ de: z.unknown(), para: z.unknown() }));

interface Change {
  field: string;
  spec: FieldSpec;
  de: unknown;
  para: unknown;
}

// Só os campos permitidos. O resto é descartado, nunca exibido.
function allowedChanges(entity: AuditEntity, raw: unknown): Change[] {
  const parsed = changesSchema.safeParse(raw);
  if (!parsed.success) return [];
  const allowed = ALLOWED_FIELDS[entity];
  return Object.entries(parsed.data)
    .filter(([field]) => Object.hasOwn(allowed, field))
    .map(([field, value]) => ({ field, spec: allowed[field], de: value.de, para: value.para }));
}

function isEntity(value: string): value is AuditEntity {
  return Object.hasOwn(ENTITIES, value);
}

// ---- Atividades ----

export interface ActivityEntry {
  id: string;
  action: AuditAction;
  entityLabel: string;
  phrase: string;
  at: string;
  fields: { label: string; from: string; to: string }[];
  reverted: boolean;
  canUndo: boolean;
}

export const ACTIVITY_PAGE_SIZE = 30;
export type ActivityPeriod = "7" | "30" | "all";

const VERBS: Record<AuditAction, string> = {
  create: "criou",
  update: "alterou",
  delete: "excluiu",
  restore: "restaurou",
};

function phraseFor(
  actor: string,
  entity: AuditEntity,
  action: AuditAction,
  summary: string | null,
  changes: Change[],
): string {
  const info = ENTITIES[entity];
  let verb = VERBS[action];
  let suffix = "";

  // Mudanças de estado têm frase própria, em vez de "alterou".
  const onlyState = action === "update" && changes.length === 1 && changes[0].field === "is_active";
  if (onlyState) {
    const active = changes[0].para === true;
    if (entity === "tenant_printers") verb = active ? "reativou" : "desativou";
    if (entity === "materials") {
      verb = active ? "restaurou" : "arquivou";
      if (active) suffix = " do arquivo";
    }
  }
  if (action === "restore") suffix = " da Lixeira";

  const name = info.showSummary && summary ? ` ${summary}` : "";
  return `${actor} ${verb} ${info.article} ${info.noun}${name}${suffix}`;
}

export async function listActivity(filters: {
  group: EntityGroup;
  period: ActivityPeriod;
  page: number;
}): Promise<{ entries: ActivityEntry[]; hasMore: boolean }> {
  const current = await getCurrentTenant();
  const user = await getCurrentUser();
  if (!current || !user) return { entries: [], hasMore: false };

  const offset = Math.max(0, filters.page - 1) * ACTIVITY_PAGE_SIZE;
  const supabase = await createClient();
  let query = supabase
    .from("audit_log")
    .select("id, entity, action, summary, changes, actor_id, reverted_at, created_at")
    .eq("tenant_id", current.tenant.id)
    .in("entity", ENTITY_GROUPS[filters.group].entities)
    .order("created_at", { ascending: false })
    // Uma linha a mais para saber se existe próxima página.
    .range(offset, offset + ACTIVITY_PAGE_SIZE);
  if (filters.period !== "all") {
    const since = new Date(Date.now() - Number(filters.period) * 86_400_000).toISOString();
    query = query.gte("created_at", since);
  }

  const { data, error } = await query;
  if (error) throw new Error("Não foi possível carregar o histórico.");

  const rows = (data ?? []) as {
    id: string;
    entity: string;
    action: AuditAction;
    summary: string | null;
    changes: unknown;
    actor_id: string | null;
    reverted_at: string | null;
    created_at: string;
  }[];
  const hasMore = rows.length > ACTIVITY_PAGE_SIZE;

  const entries: ActivityEntry[] = [];
  for (const row of rows.slice(0, ACTIVITY_PAGE_SIZE)) {
    if (!isEntity(row.entity)) continue;
    const info = ENTITIES[row.entity];
    const changes = row.action === "update" ? allowedChanges(row.entity, row.changes) : [];
    // Atualizações sem nenhum campo de negócio (por exemplo, só valores gerados) não aparecem.
    if (row.action === "update" && changes.length === 0) continue;

    const onlyState = changes.length === 1 && changes[0].field === "is_active";
    const actor = row.actor_id === user.id ? "Você" : "Outro membro";
    const undoable =
      row.reverted_at === null &&
      ((row.action === "update" && changes.length > 0) ||
        ((row.action === "create" || row.action === "delete") && info.softDelete));

    entries.push({
      id: row.id,
      action: row.action,
      entityLabel: info.label,
      phrase: phraseFor(actor, row.entity, row.action, row.summary, changes),
      at: row.created_at,
      fields: onlyState
        ? []
        : changes.map((c) => ({
            label: c.spec.label,
            from: formatValue(c.spec, c.de),
            to: formatValue(c.spec, c.para),
          })),
      reverted: row.reverted_at !== null,
      canUndo: undoable,
    });
  }
  return { entries, hasMore };
}

// ---- Lixeira ----

export interface TrashEntry {
  entity: AuditEntity;
  id: string;
  typeLabel: string;
  name: string;
  deletedAt: string;
}

const joinText = (...parts: (string | null | undefined)[]) =>
  parts.filter((p): p is string => !!p && p.trim() !== "").join(" ");

export async function listTrash(): Promise<TrashEntry[]> {
  const current = await getCurrentTenant();
  if (!current) return [];
  const tenantId = current.tenant.id;
  const supabase = await createClient();

  const [printers, materials, quotes, items] = await Promise.all([
    supabase
      .from("tenant_printers")
      .select("id, nickname, brand, model, deleted_at")
      .eq("tenant_id", tenantId)
      .not("deleted_at", "is", null)
      .limit(100),
    supabase
      .from("materials")
      .select("id, name, brand, deleted_at")
      .eq("tenant_id", tenantId)
      .not("deleted_at", "is", null)
      .limit(100),
    supabase
      .from("quotes")
      .select("id, number, customer_name, deleted_at")
      .eq("tenant_id", tenantId)
      .not("deleted_at", "is", null)
      .limit(100),
    supabase
      .from("quote_items")
      .select("id, quote_id, description, deleted_at")
      .eq("tenant_id", tenantId)
      .not("deleted_at", "is", null)
      .limit(100),
  ]);
  if (printers.error || materials.error || quotes.error || items.error) {
    throw new Error("Não foi possível carregar a lixeira.");
  }

  // Número e cliente do orçamento de cada item, só para identificar de onde ele veio.
  const quoteIds = [...new Set((items.data ?? []).map((i) => String(i.quote_id)))];
  const parents = new Map<string, string>();
  if (quoteIds.length > 0) {
    const { data } = await supabase
      .from("quotes")
      .select("id, number, customer_name")
      .eq("tenant_id", tenantId)
      .in("id", quoteIds);
    for (const q of data ?? []) {
      parents.set(String(q.id), `${String(q.number).padStart(4, "0")} ${q.customer_name}`);
    }
  }

  const list: TrashEntry[] = [
    ...(printers.data ?? []).map((r) => ({
      entity: "tenant_printers" as const,
      id: String(r.id),
      typeLabel: ENTITIES.tenant_printers.label,
      name: joinText(r.nickname || r.model, r.nickname ? null : r.brand),
      deletedAt: String(r.deleted_at),
    })),
    ...(materials.data ?? []).map((r) => ({
      entity: "materials" as const,
      id: String(r.id),
      typeLabel: ENTITIES.materials.label,
      name: joinText(r.name, r.brand),
      deletedAt: String(r.deleted_at),
    })),
    ...(quotes.data ?? []).map((r) => ({
      entity: "quotes" as const,
      id: String(r.id),
      typeLabel: ENTITIES.quotes.label,
      name: `${String(r.number).padStart(4, "0")} ${r.customer_name}`,
      deletedAt: String(r.deleted_at),
    })),
    ...(items.data ?? []).map((r) => {
      const parent = parents.get(String(r.quote_id));
      return {
        entity: "quote_items" as const,
        id: String(r.id),
        typeLabel: ENTITIES.quote_items.label,
        name: parent ? `${r.description} (orçamento ${parent})` : String(r.description),
        deletedAt: String(r.deleted_at),
      };
    }),
  ];
  return list.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

// ---- Restaurar e desfazer ----

export type OpResult = { ok: true } | { ok: false; message: string };

const GENERIC_ERROR = "Não foi possível concluir. Tente novamente.";
const CHANGED_ERROR = "Este item mudou depois dessa alteração, por isso não dá para desfazer.";
const LOCKED_ERROR = "Este orçamento está bloqueado para edição. Reabra para editar.";
const DUPLICATE_ERROR = "Já existe um item com esse nome. Renomeie o ativo e tente de novo.";
const NOT_UNDOABLE_ERROR = "Esta ação não pode ser desfeita.";

type Db = SupabaseClient;

function failure(context: string, error: { code?: string; message?: string }): OpResult {
  // Registra só o código e a mensagem do erro, sem dados do usuário.
  console.error(`Erro no histórico (${context}):`, error.code, error.message);
  return { ok: false, message: error.code === "23505" ? DUPLICATE_ERROR : GENERIC_ERROR };
}

export function isSoftDeleteEntity(value: string): value is AuditEntity {
  return isEntity(value) && ENTITIES[value].softDelete;
}

// Tira um item da Lixeira.
export async function restoreEntity(
  db: Db,
  tenantId: string,
  entity: AuditEntity,
  id: string,
): Promise<OpResult> {
  if (!ENTITIES[entity].softDelete || !UUID_PATTERN.test(id)) return { ok: false, message: GENERIC_ERROR };

  if (entity === "quote_items") {
    const { data: item } = await db
      .from("quote_items")
      .select("quote_id")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .not("deleted_at", "is", null)
      .maybeSingle();
    if (!item) return { ok: false, message: GENERIC_ERROR };
    const { data: quote } = await db
      .from("quotes")
      .select("deleted_at")
      .eq("id", String(item.quote_id))
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!quote || quote.deleted_at !== null) {
      return { ok: false, message: "Restaure o orçamento antes." };
    }
  }

  const patch: Record<string, unknown> = { deleted_at: null };
  if (ENTITIES[entity].hasUpdatedAt) patch.updated_at = new Date().toISOString();
  const { data, error } = await db
    .from(entity)
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .not("deleted_at", "is", null)
    .select("id");
  if (error) return failure("restaurar", error);
  if (!data || data.length === 0) return { ok: false, message: GENERIC_ERROR };
  return { ok: true };
}

// Manda um item para a Lixeira.
async function trashEntity(db: Db, tenantId: string, entity: AuditEntity, id: string): Promise<OpResult> {
  if (!ENTITIES[entity].softDelete || !UUID_PATTERN.test(id)) return { ok: false, message: GENERIC_ERROR };
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { deleted_at: now };
  if (ENTITIES[entity].hasUpdatedAt) patch.updated_at = now;
  const { data, error } = await db
    .from(entity)
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .select("id");
  if (error) return failure("lixeira", error);
  if (!data || data.length === 0) return { ok: false, message: CHANGED_ERROR };
  return { ok: true };
}

// Valor do log convertido para o tipo da coluna, ou undefined se não servir.
function coerce(spec: FieldSpec, value: unknown): unknown {
  if (value === null) return null;
  if (NUMERIC_KINDS.includes(spec.kind)) {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  if (spec.kind === "bool") return typeof value === "boolean" ? value : undefined;
  return typeof value === "string" ? value : undefined;
}

async function revertUpdate(
  db: Db,
  tenantId: string,
  entity: AuditEntity,
  entityId: string,
  rawChanges: unknown,
): Promise<OpResult> {
  const info = ENTITIES[entity];
  const changes = allowedChanges(entity, rawChanges);
  if (changes.length === 0) return { ok: false, message: NOT_UNDOABLE_ERROR };
  if (!info.singleton && !UUID_PATTERN.test(entityId)) return { ok: false, message: GENERIC_ERROR };

  // Valores atuais lidos do banco (RLS), só dos campos envolvidos.
  let read = db.from(entity).select(changes.map((c) => c.field).join(",")).eq("tenant_id", tenantId);
  if (!info.singleton) read = read.eq("id", entityId);
  if (info.softDelete) read = read.is("deleted_at", null);
  const { data: currentRow, error: readError } = await read.maybeSingle();
  if (readError) return failure("ler atual", readError);
  if (!currentRow) return { ok: false, message: CHANGED_ERROR };
  const current = currentRow as unknown as Record<string, unknown>;

  // Só desfaz se cada campo ainda estiver com o valor que a alteração gravou.
  for (const c of changes) {
    if (!sameValue(c.spec, current[c.field], c.para)) return { ok: false, message: CHANGED_ERROR };
  }

  const patch: Record<string, unknown> = {};
  for (const c of changes) {
    const value = coerce(c.spec, c.de);
    if (value === undefined) return { ok: false, message: NOT_UNDOABLE_ERROR };
    patch[c.field] = value;
  }

  // Regras de orçamento: status só volta por uma transição válida, e orçamento aprovado ou
  // recusado fica bloqueado para edição.
  if (entity === "quotes" || entity === "quote_items") {
    let quoteStatus: QuoteStatus | null = null;
    if (entity === "quotes") {
      const { data } = await db
        .from("quotes")
        .select("status")
        .eq("id", entityId)
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .maybeSingle();
      quoteStatus = data ? (data.status as QuoteStatus) : null;
    } else {
      const { data: item } = await db
        .from("quote_items")
        .select("quote_id")
        .eq("id", entityId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      const { data } = item
        ? await db
            .from("quotes")
            .select("status")
            .eq("id", String(item.quote_id))
            .eq("tenant_id", tenantId)
            .is("deleted_at", null)
            .maybeSingle()
        : { data: null };
      quoteStatus = data ? (data.status as QuoteStatus) : null;
    }
    if (quoteStatus === null) return { ok: false, message: CHANGED_ERROR };

    if (entity === "quotes" && "status" in patch) {
      const target = patch.status as QuoteStatus;
      if (!canTransition(quoteStatus, target)) return { ok: false, message: CHANGED_ERROR };
      patch.approved_at = target === "approved" ? new Date().toISOString() : null;
    } else if (isQuoteLocked(quoteStatus)) {
      return { ok: false, message: LOCKED_ERROR };
    }
  }

  if (info.hasUpdatedAt) patch.updated_at = new Date().toISOString();

  let write = db.from(entity).update(patch).eq("tenant_id", tenantId);
  if (!info.singleton) write = write.eq("id", entityId);
  if (info.softDelete) write = write.is("deleted_at", null);
  const { data, error } = await write.select("tenant_id");
  if (error) return failure("desfazer alteração", error);
  if (!data || data.length === 0) return { ok: false, message: CHANGED_ERROR };
  return { ok: true };
}

// Desfaz uma entrada do histórico. Só o id do registro vem do navegador: o resto é
// recarregado do banco com RLS.
export async function undoLogEntry(logId: string): Promise<OpResult> {
  if (!UUID_PATTERN.test(logId)) return { ok: false, message: GENERIC_ERROR };
  const current = await getCurrentTenant();
  if (!current) return { ok: false, message: "Não encontramos a sua conta." };
  const tenantId = current.tenant.id;
  const db = await createClient();

  const { data: row, error } = await db
    .from("audit_log")
    .select("id, entity, entity_id, action, changes, reverted_at")
    .eq("id", logId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) return failure("ler registro", error);
  if (!row || row.reverted_at !== null) return { ok: false, message: "Esta alteração já foi desfeita." };
  if (!isEntity(String(row.entity))) return { ok: false, message: NOT_UNDOABLE_ERROR };

  const entity = String(row.entity) as AuditEntity;
  const entityId = String(row.entity_id);
  const action = row.action as AuditAction;

  let result: OpResult;
  if (action === "delete") result = await restoreEntity(db, tenantId, entity, entityId);
  else if (action === "create") {
    // Criação de configurações e dados do orçamento não tem como desfazer.
    result = ENTITIES[entity].softDelete
      ? await trashEntity(db, tenantId, entity, entityId)
      : { ok: false, message: NOT_UNDOABLE_ERROR };
  } else if (action === "update") result = await revertUpdate(db, tenantId, entity, entityId, row.changes);
  else result = { ok: false, message: NOT_UNDOABLE_ERROR };
  if (!result.ok) return result;

  const { error: markError } = await db.rpc("audit_mark_reverted", { p_id: logId });
  if (markError) {
    console.error("Erro em audit_mark_reverted:", markError.code, markError.message);
    return { ok: false, message: "A alteração foi desfeita, mas o histórico não pôde ser atualizado." };
  }
  return { ok: true };
}

export { SOFT_DELETE_ENTITIES };
