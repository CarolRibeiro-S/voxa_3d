-- 020 - Período da assinatura opcional durante o teste grátis
-- Aplicada manualmente no SQL Editor do Supabase. Registro para o repositório.

alter table public.subscriptions alter column period_code drop not null;
