-- 021 - Restringir launch_remaining ao service_role
-- Aplicada manualmente no SQL Editor do Supabase. Registro para o repositório.

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as f
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'launch_remaining'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.f);
    execute format('grant execute on function %s to service_role', r.f);
  end loop;
end $$;
