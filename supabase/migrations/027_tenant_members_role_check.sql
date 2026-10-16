-- 027 - Remover a regra antiga de funções em tenant_members e manter a nova
-- Aplicada manualmente no SQL Editor do Supabase. Registro para o repositório.

do $$
declare r record;
begin
  for r in
    select conname
      from pg_constraint
     where conrelid = 'public.tenant_members'::regclass
       and contype = 'c'
       and conname <> 'tenant_members_role_chk'
       and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.tenant_members drop constraint %I', r.conname);
  end loop;

  if not exists (
    select 1 from pg_constraint
     where conname = 'tenant_members_role_chk'
       and conrelid = 'public.tenant_members'::regclass
  ) then
    alter table public.tenant_members
      add constraint tenant_members_role_chk check (role in ('owner', 'manager', 'operator'));
  end if;
end $$;
