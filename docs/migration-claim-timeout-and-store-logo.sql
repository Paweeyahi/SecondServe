-- =====================================================================
-- Auto-cancel uncollected donation claims + expire products, store logos
-- Run in Supabase Dashboard > SQL Editor. Safe to run more than once.
--
-- 1. share_claims.cancel_reason ('timeout' when the system cancelled it).
-- 2. run_expiry_jobs(): cancels reservations older than 24 h (or whose food
--    has expired) and returns the pieces to the pool; flips active products
--    past their expiry to 'expired'. Scheduled every 10 minutes with pg_cron.
-- 3. update_product(): an 'expired' product given a new future expiry date
--    goes back on sale (otherwise the job above would strand it).
-- 4. stores.logo_url + the column grant so a store can set its own logo.
--    Logo files live in the store's own products/<store_id>/ folder, which
--    the storage policies already restrict to that store.
--
-- If CREATE EXTENSION fails, enable it first: Database -> Extensions ->
-- search "pg_cron" -> enable, then run this file again.
-- =====================================================================

create extension if not exists pg_cron;

-- ---------------------------------------------------------------- 1
alter table public.share_claims add column if not exists cancel_reason text;
alter table public.share_claims drop constraint if exists share_claims_cancel_reason_check;
alter table public.share_claims add constraint share_claims_cancel_reason_check
  check (cancel_reason is null or cancel_reason = 'timeout');

-- ---------------------------------------------------------------- 2
create or replace function public.run_expiry_jobs()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claims   int;
  v_products int;
begin
  -- 1. Reservations nobody came for: older than 24 h, or the food itself has
  --    expired. Cancel them and return the pieces to the donation pool.
  with stale as (
    update public.share_claims c
       set status = 'cancelled', resolved_at = now(), cancel_reason = 'timeout'
      from public.shares s
      join public.products p on p.id = s.product_id
     where c.share_id = s.id
       and c.status = 'reserved'
       and (c.created_at < now() - interval '24 hours' or p.expiry_date <= now())
    returning c.share_id, c.quantity
  ), per_share as (
    select share_id, sum(quantity)::int as qty from stale group by share_id
  ), restock as (
    update public.shares s
       set remaining = least(s.quantity, s.remaining + ps.qty)
      from per_share ps
     where s.id = ps.share_id
    returning 1
  )
  select count(*) into v_claims from stale;

  -- 2. Products past their expiry still marked for sale.
  update public.products
     set status = 'expired'
   where status = 'active' and expiry_date <= now();
  get diagnostics v_products = row_count;

  return json_build_object('claims_cancelled', v_claims, 'products_expired', v_products);
end;
$$;

-- Only pg_cron (running as the database owner) calls this.
revoke all on function public.run_expiry_jobs() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'secondserve-expiry';
  perform cron.schedule('secondserve-expiry', '*/10 * * * *', 'select public.run_expiry_jobs()');
end $$;

-- ---------------------------------------------------------------- 3
create or replace function public.update_product(
  p_product_id uuid,
  p_name text,
  p_category text,
  p_original_price numeric,
  p_discount_price numeric,
  p_quantity int,
  p_expiry_date timestamptz,
  p_image_url text,
  p_expected_quantity int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id    uuid;
  v_status      text;
  v_db_quantity int;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select store_id, status, quantity into v_store_id, v_status, v_db_quantity
    from public.products
   where id = p_product_id
   for update;

  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  if v_store_id not in (select id from public.stores where owner_id = auth.uid()) then
    raise exception 'FORBIDDEN';
  end if;

  if v_db_quantity <> p_expected_quantity then
    raise exception 'QUANTITY_CHANGED';
  end if;

  if v_status = 'active' and p_quantity = 0 then
    v_status := 'sold_out';
  elsif v_status = 'sold_out' and p_quantity > 0 then
    v_status := 'active';
  end if;

  -- run_expiry_jobs() flips stale products to 'expired'; giving one a new
  -- future expiry date puts it back on sale (or sold_out if no stock).
  if v_status = 'expired' and p_expiry_date > now() then
    v_status := case when p_quantity > 0 then 'active' else 'sold_out' end;
  end if;

  update public.products
     set name = p_name,
         category = p_category,
         original_price = p_original_price,
         discount_price = p_discount_price,
         quantity = p_quantity,
         expiry_date = p_expiry_date,
         image_url = p_image_url,
         status = v_status
   where id = p_product_id;
end;
$$;

-- ---------------------------------------------------------------- 4
alter table public.stores add column if not exists logo_url text;
grant update (logo_url) on public.stores to authenticated;

-- Verify -- last statement, so the SQL Editor shows it after Run.
-- Running the job once here also processes anything already overdue.
select 'first run' as check_item, public.run_expiry_jobs()::text as result
union all
select 'cron job', schedule || ' ' || command from cron.job where jobname = 'secondserve-expiry'
union all
select 'share_claims.cancel_reason', data_type from information_schema.columns
 where table_schema = 'public' and table_name = 'share_claims' and column_name = 'cancel_reason'
union all
select 'stores.logo_url updatable',
       has_column_privilege('authenticated', 'public.stores', 'logo_url', 'UPDATE')::text;
-- Expect 4 rows: first run = JSON counts, cron job = "*/10 * * * * select
-- public.run_expiry_jobs()", cancel_reason = text, logo_url updatable = true.
