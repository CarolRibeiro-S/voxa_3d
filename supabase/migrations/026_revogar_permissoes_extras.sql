-- 026 - Revogar TRUNCATE, REFERENCES e TRIGGER de anon e authenticated
-- Aplicada manualmente no SQL Editor do Supabase. Registro para o repositório.

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke truncate, references, trigger on public.%I from anon, authenticated', t.tablename);
  end loop;
end $$;
