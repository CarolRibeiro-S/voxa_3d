-- 023 - Resumo do Painel direto no banco (dashboard_stats)
-- Aplicada manualmente no SQL Editor do Supabase. Registro para o repositório.

create or replace function public.dashboard_stats(
  p_tenant uuid,
  p_today date,
  p_month_start timestamptz,
  p_next_month_start timestamptz,
  p_prev_month_start timestamptz
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with o as (
    select * from public.orders where tenant_id = p_tenant and deleted_at is null
  ), q as (
    select * from public.quotes where tenant_id = p_tenant and deleted_at is null
  )
  select jsonb_build_object(
    'overdue_count', (select count(*) from o
       where kind = 'client' and status not in ('delivered','canceled') and due_date < p_today),
    'week_count', (select count(*) from o
       where kind = 'client' and status not in ('delivered','canceled')
         and due_date >= p_today and due_date <= p_today + 7),
    'receivable_count', (select count(*) from o
       where kind = 'client' and payment_status = 'pending' and status <> 'canceled'),
    'receivable_total', (select coalesce(sum(total), 0) from o
       where kind = 'client' and payment_status = 'pending' and status <> 'canceled'),
    'revenue_month', (select coalesce(sum(total), 0) from o
       where kind = 'client' and payment_status = 'paid' and status <> 'canceled'
         and paid_at >= p_month_start and paid_at < p_next_month_start),
    'revenue_prev', (select coalesce(sum(total), 0) from o
       where kind = 'client' and payment_status = 'paid' and status <> 'canceled'
         and paid_at >= p_prev_month_start and paid_at < p_month_start),
    'quotes_sent_count', (select count(*) from q where status = 'sent'),
    'quotes_sent_total', (select coalesce(sum(total_brl), 0) from q where status = 'sent'),
    'quotes_approved_month', (select count(*) from q
       where approved_at >= p_month_start and approved_at < p_next_month_start),
    'stages', (select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'status', status, 'count', n)), '[]'::jsonb)
       from (select kind, status, count(*) as n from o group by kind, status) s)
  );
$$;

revoke all on function public.dashboard_stats(uuid, date, timestamptz, timestamptz, timestamptz) from public, anon;
grant execute on function public.dashboard_stats(uuid, date, timestamptz, timestamptz, timestamptz) to authenticated;
