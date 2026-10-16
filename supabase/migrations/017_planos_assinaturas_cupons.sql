-- 017 - Planos, assinaturas, cupons e cota de lançamento
-- Aplicada manualmente no SQL Editor do Supabase. Registro para o repositório.

create table if not exists public.plans (
  code text primary key check (code in ('pro','loja')),
  name text not null,
  monthly_price_cents integer not null check (monthly_price_cents > 0),
  active boolean not null default true
);

insert into public.plans (code, name, monthly_price_cents)
values ('pro','Pro',14700), ('loja','Loja',24700)
on conflict (code) do nothing;

create table if not exists public.plan_periods (
  code text primary key check (code in ('mensal','trimestral','semestral','anual')),
  months integer not null check (months > 0),
  discount_pct numeric(5,2) not null default 0,
  launch_discount_pct numeric(5,2) not null default 0,
  sort_order integer not null
);

insert into public.plan_periods (code, months, discount_pct, launch_discount_pct, sort_order)
values
  ('mensal',1,0,25,1),
  ('trimestral',3,10,26,2),
  ('semestral',6,15,28,3),
  ('anual',12,20,30,4)
on conflict (code) do nothing;

create table if not exists public.launch_config (
  id boolean primary key default true check (id),
  quota integer not null default 30 check (quota >= 0),
  price_months integer not null default 12,
  reservation_minutes integer not null default 15,
  active boolean not null default true
);

insert into public.launch_config (id) values (true) on conflict (id) do nothing;

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  kind text not null check (kind in ('launch','referral')),
  referrer_name text,
  extra_discount_pct numeric(5,2) not null default 0,
  commission_pct numeric(5,2) not null default 0,
  commission_recurring boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists coupons_code_upper_uidx on public.coupons (upper(code));

insert into public.coupons (code, kind, referrer_name, extra_discount_pct, commission_pct)
values
  ('LANCAMENTO','launch',null,0,0),
  ('WANDA','referral','Wanda (Brasília Maker 3D)',5,20)
on conflict do nothing;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique,
  plan_code text not null references public.plans(code),
  period_code text references public.plan_periods(code),
  status text not null default 'trialing'
    check (status in ('trialing','pending_payment','active','past_due','canceled','expired')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  list_price_cents integer,
  charged_price_cents integer,
  discount_pct_applied numeric(5,2),
  launch_coupon_id uuid references public.coupons(id),
  referral_coupon_id uuid references public.coupons(id),
  promo_price_until timestamptz,
  mp_preapproval_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions alter column period_code drop not null;

create table if not exists public.launch_redemptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique,
  status text not null check (status in ('reserved','confirmed','released')),
  reserved_until timestamptz,
  seq integer unique,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table if not exists public.billing_events (
  id text primary key,
  received_at timestamptz not null default now()
);

alter table public.plans enable row level security;
alter table public.plan_periods enable row level security;
alter table public.launch_config enable row level security;
alter table public.coupons enable row level security;
alter table public.subscriptions enable row level security;
alter table public.launch_redemptions enable row level security;
alter table public.billing_events enable row level security;

drop policy if exists plans_read on public.plans;
create policy plans_read on public.plans for select to anon, authenticated using (true);

drop policy if exists plan_periods_read on public.plan_periods;
create policy plan_periods_read on public.plan_periods for select to anon, authenticated using (true);

drop policy if exists subscriptions_read on public.subscriptions;
create policy subscriptions_read on public.subscriptions for select to authenticated
  using (public.is_tenant_member(tenant_id));

revoke all on public.plans, public.plan_periods, public.launch_config, public.coupons,
  public.subscriptions, public.launch_redemptions, public.billing_events from anon, authenticated;
grant select on public.plans, public.plan_periods to anon, authenticated;
grant select on public.subscriptions to authenticated;

create or replace function public.launch_remaining()
returns integer language plpgsql volatile security definer set search_path = public as $$
declare cfg public.launch_config; used integer;
begin
  select * into cfg from public.launch_config where id = true;
  if not cfg.active then return 0; end if;
  select count(*) into used from public.launch_redemptions
   where status = 'confirmed' or (status = 'reserved' and reserved_until > now());
  return greatest(cfg.quota - used, 0);
end $$;

create or replace function public.launch_reserve(p_tenant uuid)
returns text language plpgsql volatile security definer set search_path = public as $$
declare cfg public.launch_config; used integer; r public.launch_redemptions;
begin
  select * into cfg from public.launch_config where id = true for update;
  if not cfg.active then return 'inactive'; end if;
  select * into r from public.launch_redemptions where tenant_id = p_tenant;
  if found and r.status = 'confirmed' then return 'already'; end if;
  select count(*) into used from public.launch_redemptions
   where tenant_id <> p_tenant
     and (status = 'confirmed' or (status = 'reserved' and reserved_until > now()));
  if used >= cfg.quota then return 'sold_out'; end if;
  insert into public.launch_redemptions (tenant_id, status, reserved_until)
  values (p_tenant, 'reserved', now() + make_interval(mins => cfg.reservation_minutes))
  on conflict (tenant_id) do update
    set status = 'reserved', reserved_until = excluded.reserved_until
    where public.launch_redemptions.status <> 'confirmed';
  return 'reserved';
end $$;

create or replace function public.launch_confirm(p_tenant uuid)
returns integer language plpgsql volatile security definer set search_path = public as $$
declare cfg public.launch_config; used integer; confirmed_n integer; r public.launch_redemptions;
begin
  select * into cfg from public.launch_config where id = true for update;
  select * into r from public.launch_redemptions where tenant_id = p_tenant;
  if not found then raise exception 'sem_reserva'; end if;
  if r.status = 'confirmed' then return r.seq; end if;
  select count(*) into used from public.launch_redemptions
   where tenant_id <> p_tenant
     and (status = 'confirmed' or (status = 'reserved' and reserved_until > now()));
  if used >= cfg.quota then raise exception 'esgotado'; end if;
  select count(*) into confirmed_n from public.launch_redemptions where status = 'confirmed';
  update public.launch_redemptions
     set status = 'confirmed', seq = confirmed_n + 1, confirmed_at = now(), reserved_until = null
   where tenant_id = p_tenant;
  return confirmed_n + 1;
end $$;

create or replace function public.launch_release(p_tenant uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  update public.launch_redemptions set status = 'released', reserved_until = null
   where tenant_id = p_tenant and status = 'reserved';
end $$;

revoke all on function public.launch_reserve(uuid), public.launch_confirm(uuid), public.launch_release(uuid)
  from public, anon, authenticated;
grant execute on function public.launch_reserve(uuid), public.launch_confirm(uuid), public.launch_release(uuid)
  to service_role;
grant execute on function public.launch_remaining() to anon, authenticated;
