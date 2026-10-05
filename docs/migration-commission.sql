-- =====================================================================
-- Migration: platform commission, deducted automatically per order
-- Run in Supabase Dashboard > SQL Editor. Safe to run more than once.
--
-- Payment is cash on delivery, so no money moves through the platform; the
-- "deduction" is an accounting entry recorded on every order:
--   * platform_settings.commission_rate -- one platform-wide rate (default
--     10%), changed by an admin only through admin_set_commission_rate().
--   * orders.commission_rate -- the rate snapshotted by place_order() at
--     checkout, so changing the platform rate never rewrites old orders.
--   * orders.commission_amount -- generated: item subtotal (total_amount -
--     delivery_fee; the delivery fee belongs to the rider) x rate.
-- Only completed orders count as deducted (dashboards filter on status).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. platform_settings (single row)
-- ---------------------------------------------------------------------
create table if not exists public.platform_settings (
  id              boolean primary key default true check (id),
  commission_rate numeric(5,4) not null default 0.10
                  check (commission_rate >= 0 and commission_rate <= 0.5),
  updated_at      timestamptz not null default now()
);

insert into public.platform_settings (id) values (true) on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

-- Stores see the current rate on their dashboard; it is not secret.
drop policy if exists "platform_settings_select_all" on public.platform_settings;
create policy "platform_settings_select_all" on public.platform_settings
  for select using (true);

-- No write policy: admin_set_commission_rate() is the only write path.
revoke insert, update, delete on public.platform_settings from anon, authenticated;


-- ---------------------------------------------------------------------
-- 2. orders: snapshotted rate + generated amount
-- ---------------------------------------------------------------------
-- Existing orders are backfilled with the 10% default.
alter table public.orders
  add column if not exists commission_rate numeric(5,4) not null default 0.10;

alter table public.orders drop constraint if exists orders_commission_rate_check;
alter table public.orders add constraint orders_commission_rate_check
  check (commission_rate >= 0 and commission_rate <= 0.5);

alter table public.orders
  add column if not exists commission_amount numeric(10,2)
  generated always as (round((total_amount - delivery_fee) * commission_rate, 2)) stored;


-- ---------------------------------------------------------------------
-- 3. place_order(): same as rls-policies.sql section 6, plus the rate
--    snapshot on insert.
-- ---------------------------------------------------------------------
create or replace function public.place_order(
  p_store_id       uuid,
  p_delivery_type  text,
  p_delivery_address text,
  p_items          jsonb          -- [{"product_id":"<uuid>","quantity":<int>}]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consumer uuid := auth.uid();
  v_order_id uuid;
  v_item     jsonb;
  v_qty      int;
  v_prod     public.products%rowtype;
  v_fee      numeric(10,2) := 0;
  v_items_total numeric(10,2) := 0;
  v_address  text := nullif(trim(coalesce(p_delivery_address, '')), '');
  v_rate     numeric(5,4);
begin
  if v_consumer is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (select 1 from public.profiles
                 where id = v_consumer and role = 'consumer' and suspended = false) then
    raise exception 'CONSUMER_ONLY';
  end if;

  if p_delivery_type not in ('pickup','delivery') then
    raise exception 'BAD_DELIVERY_TYPE';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  if not exists (select 1 from public.stores
                 where id = p_store_id and verified = true) then
    raise exception 'STORE_UNAVAILABLE';
  end if;

  if p_delivery_type = 'delivery' then
    if v_address is null then
      raise exception 'ADDRESS_REQUIRED';
    end if;
    select delivery_fee into v_fee from public.stores where id = p_store_id;
  else
    v_address := null;
    v_fee := 0;
  end if;

  select coalesce((select commission_rate from public.platform_settings where id), 0.10)
    into v_rate;

  insert into public.orders
    (consumer_id, store_id, delivery_type, delivery_address, delivery_fee, total_amount, status, commission_rate)
  values
    (v_consumer, p_store_id, p_delivery_type, v_address, v_fee, v_fee, 'pending', v_rate)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::int;
    if v_qty is null or v_qty <= 0 then
      raise exception 'BAD_QUANTITY';
    end if;

    update public.products
       set quantity = quantity - v_qty,
           status   = case when quantity - v_qty = 0 then 'sold_out' else status end
     where id       = (v_item->>'product_id')::uuid
       and store_id = p_store_id
       and status   = 'active'
       and quantity >= v_qty
       and expiry_date > now()
    returning * into v_prod;

    if not found then
      raise exception 'OUT_OF_STOCK:%', (v_item->>'product_id');
    end if;

    insert into public.order_items (order_id, product_id, quantity, unit_price)
    values (v_order_id, v_prod.id, v_qty, v_prod.discount_price);

    v_items_total := v_items_total + v_qty * v_prod.discount_price;
  end loop;

  update public.orders
     set total_amount = v_items_total + v_fee
   where id = v_order_id;

  return v_order_id;
end;
$$;

revoke all on function public.place_order(uuid, text, text, jsonb) from public, anon;
grant execute on function public.place_order(uuid, text, text, jsonb) to authenticated;


-- ---------------------------------------------------------------------
-- 4. admin_set_commission_rate(p_rate) -- 0 to 0.5 (0-50%)
-- ---------------------------------------------------------------------
create or replace function public.admin_set_commission_rate(p_rate numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY';
  end if;
  if p_rate is null or p_rate < 0 or p_rate > 0.5 then
    raise exception 'BAD_RATE';
  end if;

  update public.platform_settings
     set commission_rate = round(p_rate, 4), updated_at = now()
   where id;
end;
$$;

revoke all on function public.admin_set_commission_rate(numeric) from public, anon;
grant execute on function public.admin_set_commission_rate(numeric) to authenticated;


-- ---------------------------------------------------------------------
-- 5. admin_store_sales_report(): real per-order commission instead of the
--    old hard-coded 10% estimate. Adds orders count and net to store.
-- ---------------------------------------------------------------------
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
      coalesce(sum(q.items), 0)::int as quantity_sold,
      count(o.id)::int as orders,
      coalesce(sum(o.total_amount - o.delivery_fee), 0) as revenue,
      coalesce(sum(o.commission_amount), 0) as commission,
      coalesce(sum(o.total_amount - o.delivery_fee - o.commission_amount), 0) as net
    from public.stores s
    left join public.orders o on o.store_id = s.id and o.status = 'completed'
    left join lateral (
      select sum(oi.quantity) as items from public.order_items oi where oi.order_id = o.id
    ) q on true
    group by s.id, s.name
    order by revenue desc
  ) t;

  return v_result;
end;
$$;

revoke all on function public.admin_store_sales_report() from public, anon;
grant execute on function public.admin_store_sales_report() to authenticated;


-- ---------------------------------------------------------------------
-- 6. admin_commission_summary(): platform-wide totals for the dashboard
-- ---------------------------------------------------------------------
create or replace function public.admin_commission_summary()
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

  select jsonb_build_object(
    'rate', (select commission_rate from public.platform_settings where id),
    'completed_orders', count(*),
    'gross', coalesce(sum(total_amount - delivery_fee), 0),
    'commission_total', coalesce(sum(commission_amount), 0),
    'net_to_stores', coalesce(sum(total_amount - delivery_fee - commission_amount), 0),
    'commission_30d', coalesce(sum(commission_amount) filter (where created_at >= now() - interval '30 days'), 0),
    'gross_30d', coalesce(sum(total_amount - delivery_fee) filter (where created_at >= now() - interval '30 days'), 0)
  ) into v_result
  from public.orders
  where status = 'completed';

  return v_result;
end;
$$;

revoke all on function public.admin_commission_summary() from public, anon;
grant execute on function public.admin_commission_summary() to authenticated;


-- Verify -- last statement, so the SQL Editor shows it after Run.
select
  (select commission_rate from public.platform_settings) as platform_rate,
  (select count(*) from public.orders where commission_rate is not null) as orders_with_rate,
  (select coalesce(sum(commission_amount), 0) from public.orders where status = 'completed') as commission_completed,
  (select count(*) from pg_proc where proname in ('admin_set_commission_rate', 'admin_commission_summary')) as new_functions;
-- Expect 1 row: platform_rate = 0.1000, new_functions = 2.
