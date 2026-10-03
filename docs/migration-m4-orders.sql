-- =====================================================================
-- Migration M4: orders + order_items, RLS, and the atomic place_order() RPC
-- Run in Supabase Dashboard > SQL Editor. Safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tables (match docs/database.md)
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  consumer_id      uuid not null references public.profiles(id) on delete restrict,
  store_id         uuid not null references public.stores(id)   on delete restrict,
  rider_id         uuid null references public.profiles(id)     on delete set null,
  delivery_type    text not null check (delivery_type in ('pickup','delivery')),
  delivery_address text null,
  delivery_fee     numeric(10,2) not null default 0 check (delivery_fee >= 0),
  total_amount     numeric(10,2) not null check (total_amount >= 0),
  status           text not null default 'pending' check (status in
                     ('pending','confirmed','ready','rider_assigned',
                      'picked_up','delivering','completed','cancelled')),
  created_at       timestamptz not null default now(),
  constraint check_delivery_address check (
    delivery_type = 'pickup'
    or (delivery_type = 'delivery'
        and delivery_address is not null
        and char_length(trim(delivery_address)) > 0)
  )
);

create table if not exists public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id)   on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity   integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0)
);

-- keep an older orders table in step with the M4 status vocabulary
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add  constraint orders_status_check check (status in
  ('pending','confirmed','ready','rider_assigned','picked_up','delivering','completed','cancelled'));

create index if not exists idx_orders_consumer on public.orders (consumer_id, created_at desc);
create index if not exists idx_orders_store    on public.orders (store_id, created_at desc);
create index if not exists idx_order_items_order_id on public.order_items (order_id);

-- ---------------------------------------------------------------------
-- 2. RLS
-- ---------------------------------------------------------------------
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- Consumers see their own orders; stores see orders for their store;
-- riders see unclaimed ready deliveries or their own assigned orders.
drop policy if exists "orders_select_related" on public.orders;
create policy "orders_select_related" on public.orders
  for select using (
    consumer_id = auth.uid()
    or store_id in (select id from public.stores where owner_id = auth.uid())
    or rider_id = auth.uid()
    or (status = 'ready' and delivery_type = 'delivery' and rider_id is null
        and exists (select 1 from public.profiles p
                    where p.id = auth.uid() and p.role = 'rider'))
  );

-- Direct writes are done through SECURITY DEFINER functions only.
-- (place_order for consumers; later modules add store/rider transitions.)

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
        )
    )
  );

-- ---------------------------------------------------------------------
-- 3. Atomic checkout: place_order()
--    Runs as one transaction — any RAISE rolls back the whole order.
--    Server-side is the source of truth for prices, delivery fee, stock.
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

  -- store must exist and be verified
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

  insert into public.orders
    (consumer_id, store_id, delivery_type, delivery_address, delivery_fee, total_amount, status)
  values
    (v_consumer, p_store_id, p_delivery_type, v_address, v_fee, v_fee, 'pending')
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
-- 4. Verify -- this SELECT is the file's last statement, so the SQL
--    Editor's result panel shows it automatically after Run.
-- ---------------------------------------------------------------------
select 'policy: ' || policyname as check_item, cmd::text as detail
  from pg_policies where tablename in ('orders', 'order_items')
union all
select 'function: ' || proname, 'exists'
  from pg_proc where proname = 'place_order';
-- Expect 3 rows: 2 policies + 1 function.
