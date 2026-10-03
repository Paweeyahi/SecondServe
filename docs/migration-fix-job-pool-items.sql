-- =====================================================================
-- Fix: Job Pool shows "0 รายการ" for unclaimed delivery orders
-- Run in Supabase Dashboard > SQL Editor. Safe to run more than once.
--
-- "orders_select_related" (M4, tightened in M7) lets a verified rider see
-- an order row while it's still open in the Job Pool. But
-- "order_items_select_related" (M4) was never given the matching clause --
-- it only allows the consumer, the owning store, or the *assigned* rider
-- (rider_id = auth.uid()), which is nobody while the job is still
-- unclaimed. So RLS silently returned zero order_items rows for pool jobs,
-- and getJobPool()'s item_count always read 0. This adds the same
-- "open pool, verified rider" clause here too.
-- =====================================================================

drop policy if exists "order_items_select_related" on public.order_items;
create policy "order_items_select_related" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (
          o.consumer_id = auth.uid()
          or o.store_id in (select id from public.stores where owner_id = auth.uid())
          or o.rider_id = auth.uid()
          or (
            o.status = 'ready' and o.delivery_type = 'delivery' and o.rider_id is null
            and exists (
              select 1 from public.riders r
              where r.id = auth.uid() and r.verified = true
            )
          )
        )
    )
  );

-- Verify -- this SELECT is the file's last statement, so the SQL Editor's
-- result panel shows it automatically after Run.
select policyname as check_item, cmd::text as detail
  from pg_policies where tablename = 'order_items';
-- Expect 1 row: order_items_select_related.
