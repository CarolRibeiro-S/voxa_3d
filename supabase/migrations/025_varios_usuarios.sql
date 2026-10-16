-- 025 - Vários usuários: funções, convites, limite por plano e travas do Operador
-- Aplicada manualmente no SQL Editor do Supabase. Registro para o repositório.

alter table public.plans add column if not exists max_users integer not null default 1;
update public.plans set max_users = 1 where code = 'pro';
update public.plans set max_users = 3 where code = 'loja' and max_users = 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tenant_members_role_chk') then
    alter table public.tenant_members
      add constraint tenant_members_role_chk check (role in ('owner', 'manager', 'operator'));
  end if;
end $$;

create or replace function public.tenant_role(p_tenant uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.tenant_members
   where tenant_id = p_tenant and user_id = auth.uid()
   limit 1;
$$;

revoke all on function public.tenant_role(uuid) from public, anon;
grant execute on function public.tenant_role(uuid) to authenticated, service_role;

alter table public.tenant_members enable row level security;
drop policy if exists tenant_members_read_team on public.tenant_members;
create policy tenant_members_read_team on public.tenant_members
  for select to authenticated using (public.is_tenant_member(tenant_id));

create table if not exists public.tenant_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  email text not null,
  role text not null check (role in ('manager', 'operator')),
  token_hash text not null unique,
  invited_by uuid,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists tenant_invites_pending_uidx
  on public.tenant_invites (tenant_id, lower(email))
  where accepted_at is null and revoked_at is null;

alter table public.tenant_invites enable row level security;
drop policy if exists tenant_invites_owner_read on public.tenant_invites;
create policy tenant_invites_owner_read on public.tenant_invites
  for select to authenticated using (public.tenant_role(tenant_id) = 'owner');

revoke all on public.tenant_invites from anon, authenticated;
grant select on public.tenant_invites to authenticated;

do $$
declare t text;
begin
  foreach t in array array['tenant_printers','materials','quotes','quote_items','tenant_profile','cost_settings','sales_channels','order_items'] loop
    execute format('drop policy if exists operator_no_insert on public.%I', t);
    execute format('drop policy if exists operator_no_update on public.%I', t);
    execute format('create policy operator_no_insert on public.%I as restrictive for insert to authenticated with check (public.tenant_role(tenant_id) is distinct from ''operator'')', t);
    execute format('create policy operator_no_update on public.%I as restrictive for update to authenticated using (public.tenant_role(tenant_id) is distinct from ''operator'') with check (public.tenant_role(tenant_id) is distinct from ''operator'')', t);
  end loop;
end $$;

drop policy if exists operator_no_insert on public.orders;
create policy operator_no_insert on public.orders
  as restrictive for insert to authenticated
  with check (public.tenant_role(tenant_id) is distinct from 'operator');

create or replace function public.orders_operator_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.tenant_role(new.tenant_id) = 'operator' then
    if (to_jsonb(new) - array['status', 'status_changed_at', 'updated_at'])
       is distinct from (to_jsonb(old) - array['status', 'status_changed_at', 'updated_at']) then
      raise exception 'Operador só pode mudar a etapa do pedido.' using errcode = '42501';
    end if;
    if new.status not in ('placed', 'printing', 'ready') or old.status not in ('placed', 'printing', 'ready') then
      raise exception 'Operador só pode mover entre Pedido feito, Imprimindo e Pronto.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists orders_operator_guard_trg on public.orders;
create trigger orders_operator_guard_trg
  before update on public.orders
  for each row execute function public.orders_operator_guard();
