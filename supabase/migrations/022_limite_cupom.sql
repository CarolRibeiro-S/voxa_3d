-- 022 - Limite de tentativas de validação de cupom (coupon_rate_check)
-- Aplicada manualmente no SQL Editor do Supabase. Registro para o repositório.

create or replace function public.coupon_rate_check(p_key text, p_limit integer default 20)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_bucket timestamptz := to_timestamp(floor(extract(epoch from now()) / 600) * 600);
  v_user uuid := md5(coalesce(p_key, 'anon'))::uuid;
  v_calls integer;
begin
  update public.rpc_usage
     set calls = calls + 1
   where bucket = v_bucket and fn = 'coupon_validate' and user_id = v_user
   returning calls into v_calls;

  if not found then
    insert into public.rpc_usage (bucket, fn, user_id, calls)
    values (v_bucket, 'coupon_validate', v_user, 1);
    v_calls := 1;
  end if;

  return v_calls <= p_limit;
end $$;

revoke all on function public.coupon_rate_check(text, integer) from public, anon, authenticated;
grant execute on function public.coupon_rate_check(text, integer) to service_role;
