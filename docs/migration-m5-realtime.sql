-- =====================================================================
-- Migration M5: enable Realtime postgres_changes on orders
-- Run in Supabase Dashboard > SQL Editor. Safe to run more than once.
--
-- RLS on public.orders (see migration-m4-orders.sql, "orders_select_related")
-- already restricts which rows each authenticated client can receive over
-- Realtime -- no policy changes needed here.
-- =====================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

-- Verify -- this SELECT is the file's last statement, so the SQL Editor's
-- result panel shows it automatically after Run.
select tablename as check_item, 'realtime enabled' as detail
  from pg_publication_tables
 where pubname = 'supabase_realtime' and tablename = 'orders';
-- Expect 1 row (orders).
