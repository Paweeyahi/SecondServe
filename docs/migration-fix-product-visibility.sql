-- =====================================================================
-- Fix: order history shows "สินค้า" with no image once a product's status
-- changes (sold_out / expired / shared)
-- Run in Supabase Dashboard > SQL Editor. Safe to run more than once.
--
-- products RLS only ever granted SELECT to: the public (status='active' AND
-- quantity>0 AND expiry_date>now(), from migration-m2-products.sql /
-- migration-fix-expiry-gate.sql), or the owning store
-- (products_select_own). Nobody else could see a product row once it
-- stopped being "currently sellable" -- so a consumer viewing their own past
-- order, or a rider viewing their delivery job, got `product: null` from the
-- order_items join (PostgREST silently drops embeds RLS hides) and the UI
-- fell back to the generic "สินค้า" placeholder with no image.
--
-- This adds a policy so a product stays visible to anyone who has a
-- legitimate reason to see it via an order: the consumer who bought it, the
-- rider assigned to (or eligible to claim, for the open Job Pool) that
-- delivery, or the owning store -- regardless of the product's current
-- status. Mirrors the exact clauses already used in
-- orders_select_related / order_items_select_related (M4/M7).
-- =====================================================================

drop policy if exists "products_select_order_related" on public.products;
create policy "products_select_order_related" on public.products
  for select using (
    exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.product_id = products.id
        and (
          o.consumer_id = auth.uid()
          or o.rider_id = auth.uid()
          or o.store_id in (select id from public.stores where owner_id = auth.uid())
          or (
            o.status = 'ready' and o.delivery_type = 'delivery' and o.rider_id is null
            and exists (
              select 1 from public.riders r where r.id = auth.uid() and r.verified = true
            )
          )
        )
    )
  );

-- Verify -- this SELECT is the file's last statement, so the SQL Editor's
-- result panel shows it automatically after Run.
select policyname as check_item, cmd::text as detail
  from pg_policies where tablename = 'products' and policyname = 'products_select_order_related';
-- Expect 1 row.
