-- =====================================================================
-- Fix: exclude already-expired products from public sale
-- Run in Supabase Dashboard > SQL Editor. Safe to run more than once.
--
-- Nothing in this app flips a product's `status` to 'expired' on a timer --
-- `ExpiryBadge` is a display-only calculation. That meant a product past its
-- `expiry_date` but still `status = 'active'` stayed visible in the public
-- catalog / store page and could still be checked out. This closes the gap
-- at both layers that actually decide what a consumer can see and buy: the
-- RLS policy from M2 (migration-m2-products.sql) and the place_order()
-- checkout RPC from M4 (migration-m4-orders.sql).
-- =====================================================================

drop policy if exists "products_select_public" on public.products;
create policy "products_select_public" on public.products
  for select using (
    status = 'active'
    and quantity > 0
    and expiry_date > now()
    and exists (
      select 1 from public.stores s
      where s.id = products.store_id and s.verified = true
    )
  );

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

-- Verify -- this SELECT is the file's last statement, so the SQL Editor's
-- result panel shows it automatically after Run.
select 'policy: ' || policyname as check_item, cmd::text as detail
  from pg_policies where policyname = 'products_select_public'
union all
select 'function: ' || proname, 'exists'
  from pg_proc where proname = 'place_order';
-- Expect 2 rows.
