-- 018 - Pedidos (orders) e itens do pedido, RLS, número sequencial por loja e total automático
-- Aplicada manualmente no SQL Editor do Supabase. Registro para o repositório.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  number integer,
  kind text not null default 'client' check (kind in ('client','stock')),
  status text not null default 'placed'
    check (status in ('placed','printing','ready','shipped','delivered','canceled')),
  quote_id uuid references public.quotes(id),
  client_name text,
  client_phone text,
  due_date date,
  payment_status text not null default 'pending' check (payment_status in ('pending','paid')),
  paid_at timestamptz,
  tracking_code text,
  notes text,
  total numeric(12,2) not null default 0,
  status_changed_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_client_has_name
    check (kind = 'stock' or (client_name is not null and length(btrim(client_name)) > 0)),
  constraint orders_tenant_number_uk unique (tenant_id, number)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  order_id uuid not null references public.orders(id),
  quote_item_id uuid references public.quote_items(id),
  description text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists orders_tenant_status_idx on public.orders (tenant_id, status) where deleted_at is null;
create index if not exists orders_tenant_due_idx on public.orders (tenant_id, due_date) where deleted_at is null;
create index if not exists order_items_order_idx on public.order_items (order_id) where deleted_at is null;
create unique index if not exists orders_quote_uidx on public.orders (quote_id) where quote_id is not null and deleted_at is null;

create or replace function public.orders_set_number()
returns trigger language plpgsql as $$
begin
  if new.number is null then
    perform pg_advisory_xact_lock(hashtext('orders:' || new.tenant_id::text));
    select coalesce(max(number), 0) + 1 into new.number
      from public.orders where tenant_id = new.tenant_id;
  end if;
  return new;
end $$;

drop trigger if exists orders_set_number_trg on public.orders;
create trigger orders_set_number_trg before insert on public.orders
  for each row execute function public.orders_set_number();

create or replace function public.orders_recalc_total()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_order uuid;
begin
  v_order := coalesce(new.order_id, old.order_id);
  update public.orders o
     set total = coalesce((select sum(i.line_total) from public.order_items i
                            where i.order_id = v_order and i.deleted_at is null), 0),
         updated_at = now()
   where o.id = v_order;
  return null;
end $$;

drop trigger if exists order_items_recalc_total_trg on public.order_items;
create trigger order_items_recalc_total_trg after insert or update or delete on public.order_items
  for each row execute function public.orders_recalc_total();

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy orders_select on public.orders for select to authenticated
  using (public.is_tenant_member(tenant_id));
create policy orders_insert on public.orders for insert to authenticated
  with check (public.is_tenant_member(tenant_id));
create policy orders_update on public.orders for update to authenticated
  using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));

create policy order_items_select on public.order_items for select to authenticated
  using (public.is_tenant_member(tenant_id));
create policy order_items_insert on public.order_items for insert to authenticated
  with check (public.is_tenant_member(tenant_id));
create policy order_items_update on public.order_items for update to authenticated
  using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));

revoke all on public.orders, public.order_items from anon, authenticated;
grant select, insert, update on public.orders, public.order_items to authenticated;
