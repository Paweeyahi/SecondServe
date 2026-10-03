-- =====================================================================
-- Add: admin_store_sales_report() -- per-store revenue + commission
-- Run in Supabase Dashboard > SQL Editor. Safe to run more than once.
--
-- Feeds a new chart on /dashboard/admin/users. Matches the M9 pattern
-- (migration-m9-admin.sql): one aggregate RPC instead of loosening
-- orders/order_items RLS for admin-wide row-level reads.
--
-- COMMISSION_RATE below is a placeholder business assumption (10% of
-- completed-order revenue) -- there is no commission field or billing
-- system anywhere else in this app (scope.md rules out payment gateways;
-- it's Cash on Delivery). Adjust the literal `0.10` if the real rate differs.
-- =====================================================================

create or replace function public.admin_store_sales_report()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY';
  end if;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_result
  from (
    select
      s.id as store_id,
      s.name as store_name,
      coalesce(sum(oi.quantity), 0)::int as quantity_sold,
      coalesce(sum(oi.quantity * oi.unit_price), 0) as revenue,
      round(coalesce(sum(oi.quantity * oi.unit_price), 0) * 0.10, 2) as commission
    from public.stores s
    left join public.orders o on o.store_id = s.id and o.status = 'completed'
    left join public.order_items oi on oi.order_id = o.id
    group by s.id, s.name
    order by revenue desc
  ) t;

  return v_result;
end;
$$;

revoke all on function public.admin_store_sales_report() from public, anon;
grant execute on function public.admin_store_sales_report() to authenticated;

-- Verify -- this SELECT is the file's last statement, so the SQL Editor's
-- result panel shows it automatically after Run.
select proname as check_item, 'exists' as detail
  from pg_proc where proname = 'admin_store_sales_report';
-- Expect 1 row.
