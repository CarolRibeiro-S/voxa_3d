-- 026b - Revogar TRUNCATE, REFERENCES e TRIGGER das views restantes
-- Aplicada manualmente no SQL Editor do Supabase. Registro para o repositório.

do $$
declare r record;
begin
  for r in
    select c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('v', 'm', 'f')
  loop
    execute format('revoke truncate, references, trigger on public.%I from anon, authenticated', r.relname);
  end loop;
end $$;
