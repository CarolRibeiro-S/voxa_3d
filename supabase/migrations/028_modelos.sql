-- 028 - Modelos: tabela, vínculo com itens, bucket de fotos e limite por plano
-- Aplicada manualmente no SQL Editor do Supabase. Registro para o repositório.

alter table public.plans add column if not exists max_models integer not null default 100;
update public.plans set max_models = 100 where code = 'pro';
update public.plans set max_models = 500 where code = 'loja';

create table if not exists public.models (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  source_url text check (source_url is null or char_length(source_url) <= 500),
  material_hint text check (material_hint is null or char_length(material_hint) <= 120),
  default_weight_g numeric(10,2) check (default_weight_g is null or default_weight_g >= 0),
  default_print_minutes integer check (default_print_minutes is null or default_print_minutes >= 0),
  print_notes text check (print_notes is null or char_length(print_notes) <= 2000),
  photo_path text check (photo_path is null or char_length(photo_path) <= 300),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists models_tenant_name_uidx
  on public.models (tenant_id, lower(btrim(name))) where deleted_at is null;
create index if not exists models_tenant_idx on public.models (tenant_id, deleted_at);

create or replace function public.models_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists models_set_updated_at_trg on public.models;
create trigger models_set_updated_at_trg
  before update on public.models
  for each row execute function public.models_set_updated_at();

alter table public.models enable row level security;

drop policy if exists models_select on public.models;
create policy models_select on public.models
  for select to authenticated using (public.is_tenant_member(tenant_id));

drop policy if exists models_insert on public.models;
create policy models_insert on public.models
  for insert to authenticated with check (public.is_tenant_member(tenant_id));

drop policy if exists models_update on public.models;
create policy models_update on public.models
  for update to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

drop policy if exists operator_no_insert on public.models;
create policy operator_no_insert on public.models
  as restrictive for insert to authenticated
  with check (public.tenant_role(tenant_id) is distinct from 'operator');

drop policy if exists operator_no_update on public.models;
create policy operator_no_update on public.models
  as restrictive for update to authenticated
  using (public.tenant_role(tenant_id) is distinct from 'operator')
  with check (public.tenant_role(tenant_id) is distinct from 'operator');

revoke all on public.models from anon, authenticated;
grant select, insert, update on public.models to authenticated;

drop trigger if exists audit_row_change_trg on public.models;
create trigger audit_row_change_trg
  after insert or update on public.models
  for each row execute function public.audit_row_change();

alter table public.order_items add column if not exists model_id uuid references public.models(id) on delete set null;
alter table public.quote_items add column if not exists model_id uuid references public.models(id) on delete set null;
create index if not exists order_items_model_idx on public.order_items (model_id) where model_id is not null;
create index if not exists quote_items_model_idx on public.quote_items (model_id) where model_id is not null;

create or replace function public.assert_model_same_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.model_id is not null and not exists (
    select 1 from public.models m where m.id = new.model_id and m.tenant_id = new.tenant_id
  ) then
    raise exception 'Modelo não pertence a esta loja.' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists order_items_model_tenant_trg on public.order_items;
create trigger order_items_model_tenant_trg
  before insert or update of model_id on public.order_items
  for each row execute function public.assert_model_same_tenant();

drop trigger if exists quote_items_model_tenant_trg on public.quote_items;
create trigger quote_items_model_tenant_trg
  before insert or update of model_id on public.quote_items
  for each row execute function public.assert_model_same_tenant();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('model-photos', 'model-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists model_photos_read on storage.objects;
create policy model_photos_read on storage.objects
  for select to authenticated
  using (bucket_id = 'model-photos' and exists (
    select 1 from public.tenant_members tm
     where tm.user_id = auth.uid() and tm.tenant_id::text = (storage.foldername(name))[1]));

drop policy if exists model_photos_insert on storage.objects;
create policy model_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'model-photos' and exists (
    select 1 from public.tenant_members tm
     where tm.user_id = auth.uid() and tm.role in ('owner', 'manager')
       and tm.tenant_id::text = (storage.foldername(name))[1]));

drop policy if exists model_photos_update on storage.objects;
create policy model_photos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'model-photos' and exists (
    select 1 from public.tenant_members tm
     where tm.user_id = auth.uid() and tm.role in ('owner', 'manager')
       and tm.tenant_id::text = (storage.foldername(name))[1]));

drop policy if exists model_photos_delete on storage.objects;
create policy model_photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'model-photos' and exists (
    select 1 from public.tenant_members tm
     where tm.user_id = auth.uid() and tm.role in ('owner', 'manager')
       and tm.tenant_id::text = (storage.foldername(name))[1]));
