-- M10 atomicity re-review found a lost-update race in updateProduct
-- (src/lib/actions/products.ts): the edit form is pre-filled with quantity
-- at page-render time. If a customer's order decrements stock (place_order's
-- atomic UPDATE) between the store owner opening the edit page and hitting
-- save, the plain `update products set quantity = <stale form value>` used
-- here silently overwrites the concurrent sale's decrement -- a classic
-- TOCTOU gap, since the write never checked whether quantity had moved.
--
-- Fix: route product edits through a SECURITY DEFINER function that locks
-- the row (`for update`) and compares the current quantity against
-- `p_expected_quantity` (the value the edit form was rendered with, carried
-- through as a hidden field) before writing -- exactly the row-lock pattern
-- already used by share_product(). A concurrent sale in that gap now makes
-- the save fail with QUANTITY_CHANGED instead of clobbering the real stock
-- count.

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

  -- Keep shared/expired as-is; otherwise sync active <-> sold_out with stock
  -- (same rule updateProduct enforced client-side before).
  if v_status = 'active' and p_quantity = 0 then
    v_status := 'sold_out';
  elsif v_status = 'sold_out' and p_quantity > 0 then
    v_status := 'active';
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

revoke all on function public.update_product(
  uuid, text, text, numeric, numeric, int, timestamptz, text, int
) from public, anon;
grant execute on function public.update_product(
  uuid, text, text, numeric, numeric, int, timestamptz, text, int
) to authenticated;

select proname, pronargs
  from pg_proc
 where pronamespace = 'public'::regnamespace and proname = 'update_product';
-- Expect exactly 1 row.
