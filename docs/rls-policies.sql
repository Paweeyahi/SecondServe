-- =====================================================================
-- SecondServe: consolidated RLS policies + access-control functions
-- =====================================================================
-- This is the single source of truth for "what security rule applies to
-- this table/action *right now*" (M10 checkpoint). It supersedes reading
-- migration-m1..m12 + migration-fix-*.sql in order to reconstruct the
-- current state -- several policies and functions were replaced more than
-- once across those files (see the "Replaces" note on each block below).
--
-- Scope: RLS policies + the SECURITY DEFINER functions that are the *only*
-- write path for every table in this app ((this project's consistent
-- pattern: no table allows direct client INSERT/UPDATE beyond a narrow
-- "own row" case -- everything else goes through a function that re-checks
-- the caller's relationship to the row before writing).
--
-- NOT included here: CREATE TABLE / column DDL (see docs/database.md and
-- the individual migration-mN-*.sql files for schema history), seed data.
-- This file assumes every table already exists (i.e. migration-m1 through
-- migration-m12 and every migration-fix-*.sql have already been run once).
--
-- Safe to re-run in full at any time -- every statement is
-- idempotent (DROP + CREATE POLICY, or CREATE OR REPLACE FUNCTION).
-- Running this file is itself a good sanity check: it re-asserts the
-- canonical final state in case any environment only got a partial/older
-- subset of the migration-fix-*.sql files applied.
-- =====================================================================


-- #######################################################################
-- # 0. Shared helper
-- #######################################################################

-- SECURITY DEFINER so it reads profiles without going through profiles'
-- own RLS (avoids self-referencing-policy subtleties). Used by every
-- admin policy/function below. [introduced: migration-m9-admin.sql]
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- anon needs EXECUTE too: policies reached through subqueries call this
-- for logged-out visitors, and a missing grant fails the whole query
-- (returns false for anon, since auth.uid() is null).
-- [migration-fix-anon-is-admin.sql]
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Populates profiles (+ stores/riders for those roles) on signup. SECURITY
-- DEFINER so it can insert regardless of RLS; the EXCEPTION handler is
-- deliberate -- a failure here must never block auth.users signup itself.
-- Role is whitelisted to consumer/store/rider. [FINAL: migration-fix-admin-signup.sql]
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Signup metadata is client-controlled (anyone can call the public
  -- /auth/v1/signup API directly), so only self-service roles are honoured;
  -- 'admin' or anything unexpected becomes a plain consumer. Admins are
  -- promoted afterwards with service-role / SQL access only.
  v_role  text := case
                    when new.raw_user_meta_data->>'role' in ('consumer', 'store', 'rider')
                      then new.raw_user_meta_data->>'role'
                    else 'consumer'
                  end;
  v_name  text := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'ผู้ใช้ใหม่');
  v_phone text := coalesce(nullif(trim(new.raw_user_meta_data->>'phone'), ''), '000000000');
begin
  insert into public.profiles (id, role, full_name, phone)
  values (new.id, v_role, v_name, v_phone)
  on conflict (id) do nothing;

  if v_role = 'store' then
    insert into public.stores (owner_id, name, address, latitude, longitude, phone)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data->>'store_name'), ''), v_name),
      coalesce(nullif(trim(new.raw_user_meta_data->>'store_address'), ''), 'ยังไม่ได้ระบุที่อยู่ร้านค้า'),
      13.7563,
      100.5018,
      v_phone
    )
    on conflict (owner_id) do nothing;
  end if;

  if v_role = 'rider' then
    insert into public.riders (id, vehicle_type, license_plate, status)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data->>'vehicle_type', ''), 'motorcycle'),
      coalesce(nullif(trim(new.raw_user_meta_data->>'license_plate'), ''), 'รอลงทะเบียน'),
      'offline'
    )
    on conflict (id) do nothing;
  end if;

  return new;
exception
  when others then
    raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- #######################################################################
-- # 1. profiles
-- #######################################################################
alter table public.profiles enable row level security;

-- [fix-auth-signup.sql / M1]
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

-- [migration-m9-admin.sql] -- lets moderation tables list every user
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles
  for select using (public.is_admin());

-- [fix-profiles-visibility.sql] -- otherwise the consumer:profiles(...) embed
-- on orders comes back null for the store/rider side (RLS-hidden embed -> null)
drop policy if exists "profiles_select_order_related" on public.profiles;
create policy "profiles_select_order_related" on public.profiles
  for select using (
    exists (
      select 1 from public.orders o
      where o.consumer_id = profiles.id
        and (
          o.store_id in (select id from public.stores where owner_id = auth.uid())
          or o.rider_id = auth.uid()
        )
    )
  );

-- Replaces: profiles_select_reviewer (fix-profiles-visibility.sql), which
-- exposed the whole row -- incl. phone -- of every reviewer to anyone.
-- Reviewer names now come only via reviewer_names() below (id + abbreviated name).
-- [FINAL: migration-fix-reviewer-privacy.sql]
drop policy if exists "profiles_select_reviewer" on public.profiles;

-- Returns a shortened display name ("สมใจ บุญรอด" -> "สมใจ บ.") so the
-- reviewer's full name never leaves the database. Thai leading vowels
-- (เ แ โ ใ ไ) are written before their consonant, so for a surname that
-- starts with one the initial keeps two characters ("เจริญ" -> "เจ.").
drop function if exists public.reviewer_names(uuid[]);

create or replace function public.reviewer_names(p_ids uuid[])
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         case
           when coalesce(parts[2], '') = '' then parts[1]
           else parts[1] || ' ' ||
                case when left(parts[2], 1) in ('เ', 'แ', 'โ', 'ใ', 'ไ')
                     then left(parts[2], 2)
                     else left(parts[2], 1)
                end || '.'
         end
    from public.profiles p
    cross join lateral regexp_split_to_array(btrim(p.full_name), '\s+') as parts
   where p.id = any(p_ids)
     and exists (select 1 from public.reviews r where r.consumer_id = p.id);
$$;

revoke all on function public.reviewer_names(uuid[]) from public;
grant execute on function public.reviewer_names(uuid[]) to anon, authenticated;

-- [migration-share-claims.sql] -- the donating store needs the claimer's
-- name/phone to hand community-shared food over
drop policy if exists "profiles_select_share_claimer" on public.profiles;
create policy "profiles_select_share_claimer" on public.profiles
  for select using (
    exists (
      select 1
      from public.share_claims c
      join public.shares s on s.id = c.share_id
      where c.claimer_id = profiles.id
        and s.store_id in (select id from public.stores where owner_id = auth.uid())
    )
  );

-- [fix-auth-signup.sql / M1] -- the on_auth_user_created trigger
-- (SECURITY DEFINER) is what actually creates the row; this just lets a
-- client-side insert succeed too if ever needed.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- [fix-auth-signup.sql / M1]
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- No direct client path flips `suspended` for someone else's row --
-- admin_set_user_suspended() (section 8) is the only way.


-- #######################################################################
-- # 2. stores
-- #######################################################################
alter table public.stores enable row level security;

-- [fix-auth-signup.sql / M1] -- public storefront listing needs this
drop policy if exists "stores_select_all" on public.stores;
create policy "stores_select_all" on public.stores
  for select using (true);

-- [fix-auth-signup.sql / M1]
drop policy if exists "stores_insert_own" on public.stores;
create policy "stores_insert_own" on public.stores
  for insert with check (auth.uid() = owner_id);

-- [fix-auth-signup.sql / M1]
drop policy if exists "stores_update_own" on public.stores;
create policy "stores_update_own" on public.stores
  for update using (auth.uid() = owner_id);

-- No direct client path flips `verified` for someone else's row --
-- admin_set_store_verified() (section 8) is the only way.


-- #######################################################################
-- # 3. riders
-- #######################################################################
alter table public.riders enable row level security;

-- [fix-auth-signup.sql / M1]
drop policy if exists "riders_select_own" on public.riders;
create policy "riders_select_own" on public.riders
  for select using (auth.uid() = id);

-- [migration-m9-admin.sql] -- lets moderation tables list every rider
drop policy if exists "riders_select_admin" on public.riders;
create policy "riders_select_admin" on public.riders
  for select using (public.is_admin());

-- [fix-auth-signup.sql / M1]
drop policy if exists "riders_insert_own" on public.riders;
create policy "riders_insert_own" on public.riders
  for insert with check (auth.uid() = id);

-- [fix-auth-signup.sql / M1] -- covers the shift toggle (available/offline);
-- set_rider_shift() (section 8) additionally blocks it while status='busy',
-- and claim_delivery_job()/mark_delivered() flip status server-side.
drop policy if exists "riders_update_own" on public.riders;
create policy "riders_update_own" on public.riders
  for update using (auth.uid() = id);

-- No direct client path flips `verified` for someone else's row --
-- admin_set_rider_verified() (section 8) is the only way.


-- #######################################################################
-- # 4. products
-- #######################################################################
alter table public.products enable row level security;

-- Replaces: migration-m2-products.sql's version (added expiry_date > now()).
-- [FINAL: migration-fix-expiry-gate.sql]
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

-- Shared (donated) products are on the public /shares feed, so their
-- name/image must be readable by anyone -- products_select_public above
-- only covers status = 'active'. [migration-share-claims.sql]
drop policy if exists "products_select_shared" on public.products;
create policy "products_select_shared" on public.products
  for select using (status = 'shared');

-- A store owner sees every one of their own products, any status.
-- [migration-m2-products.sql]
drop policy if exists "products_select_own" on public.products;
create policy "products_select_own" on public.products
  for select using (
    store_id in (select id from public.stores where owner_id = auth.uid())
  );

-- Keeps a product's name/image visible in *historical* order/job views even
-- after it goes sold_out / expired / shared -- consumer, rider, store on
-- that order, or an eligible rider still browsing the open Job Pool.
-- [migration-fix-product-visibility.sql]
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

-- [migration-m2-products.sql]
drop policy if exists "products_insert_own" on public.products;
create policy "products_insert_own" on public.products
  for insert with check (
    store_id in (select id from public.stores where owner_id = auth.uid())
  );

-- Still used directly by createProduct/setProductStatus/deleteProduct
-- (simple absolute writes, no read-then-write race). updateProduct routes
-- through update_product() below instead, since it edits quantity based on
-- a value read earlier (at edit-page render time).
-- No direct path into or out of 'shared' -- share_product() only.
-- [FINAL: migration-fix-storage-and-shared-status.sql]
drop policy if exists "products_update_own" on public.products;
create policy "products_update_own" on public.products
  for update
  using (
    store_id in (select id from public.stores where owner_id = auth.uid())
    and status <> 'shared'
  )
  with check (
    store_id in (select id from public.stores where owner_id = auth.uid())
    and status <> 'shared'
  );

-- Closes the lost-update race in the product edit form: the form is
-- pre-filled with quantity at page-render time, so a plain UPDATE with the
-- submitted value can silently undo a concurrent sale's atomic stock
-- decrement (place_order) if the store owner submits an unrelated edit
-- without noticing stock changed underneath them. Locks the row (`for
-- update`, same pattern as share_product() below) and requires the caller's
-- `p_expected_quantity` to still match -- otherwise raises QUANTITY_CHANGED
-- instead of overwriting. [migration-fix-product-update-race.sql]
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

revoke all on function public.update_product(
  uuid, text, text, numeric, numeric, int, timestamptz, text, int
) from public, anon;
grant execute on function public.update_product(
  uuid, text, text, numeric, numeric, int, timestamptz, text, int
) to authenticated;

drop policy if exists "products_delete_own" on public.products;
create policy "products_delete_own" on public.products
  for delete using (
    store_id in (select id from public.stores where owner_id = auth.uid())
  );

-- Storage bucket 'products' -- public read, owner-store-only writes.
-- [migration-m2-products.sql]
insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do update set public = true;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read" on storage.objects
  for select using (bucket_id = 'products');

-- Writes limited to products/<a store the caller owns>/...
-- [FINAL: migration-fix-storage-and-shared-status.sql]
drop policy if exists "product_images_store_insert" on storage.objects;
create policy "product_images_store_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'products'
    and (storage.foldername(name))[1] in (
      select id::text from public.stores where owner_id = auth.uid()
    )
  );

drop policy if exists "product_images_store_update" on storage.objects;
create policy "product_images_store_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'products'
    and (storage.foldername(name))[1] in (
      select id::text from public.stores where owner_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'products'
    and (storage.foldername(name))[1] in (
      select id::text from public.stores where owner_id = auth.uid()
    )
  );

drop policy if exists "product_images_store_delete" on storage.objects;
create policy "product_images_store_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'products'
    and (storage.foldername(name))[1] in (
      select id::text from public.stores where owner_id = auth.uid()
    )
  );


-- #######################################################################
-- # 5. orders + order_items
-- #######################################################################
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- Replaces: migration-m4-orders.sql's version (job-pool clause checked
-- profiles.role = 'rider' only, not riders.verified).
-- [FINAL: migration-m7-rider-delivery.sql]
drop policy if exists "orders_select_related" on public.orders;
create policy "orders_select_related" on public.orders
  for select using (
    consumer_id = auth.uid()
    or store_id in (select id from public.stores where owner_id = auth.uid())
    or rider_id = auth.uid()
    or (
      status = 'ready' and delivery_type = 'delivery' and rider_id is null
      and exists (
        select 1 from public.riders r
        where r.id = auth.uid() and r.verified = true
      )
    )
  );

-- No insert/update/delete policy on orders -- every mutation goes through
-- a SECURITY DEFINER function (place_order, confirm_order, mark_order_ready,
-- complete_pickup_order, cancel_order, claim_delivery_job, mark_picked_up,
-- mark_delivering, mark_delivered -- section 6/7).

-- Replaces: migration-m4-orders.sql's version (missing the open-pool clause,
-- which caused the Job Pool to always show "0 รายการ" for unclaimed jobs).
-- [FINAL: migration-fix-job-pool-items.sql]
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

-- No write policy on order_items -- rows are only ever inserted inside
-- place_order() (section 6).


-- #######################################################################
-- # 6. Checkout (consumer) -- place_order()
-- #######################################################################

-- Replaces: migration-m4-orders.sql's version (missing expiry_date > now()
-- in the stock-decrement WHERE clause -- an already-expired-but-still-
-- 'active' product could still be checked out).
-- [FINAL: migration-fix-expiry-gate.sql]
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


-- #######################################################################
-- # 7. Store fulfillment + rider delivery transitions
-- #######################################################################
-- Every transition is one guarded UPDATE (id + expected status + ownership);
-- 0 rows affected raises STALE_OR_FORBIDDEN. [migration-m6-store-orders.sql]

create or replace function public.confirm_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.orders
     set status = 'confirmed'
   where id = p_order_id
     and status = 'pending'
     and store_id in (select id from public.stores where owner_id = auth.uid());

  if not found then
    raise exception 'STALE_OR_FORBIDDEN';
  end if;
end;
$$;

create or replace function public.mark_order_ready(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.orders
     set status = 'ready'
   where id = p_order_id
     and status = 'confirmed'
     and store_id in (select id from public.stores where owner_id = auth.uid());

  if not found then
    raise exception 'STALE_OR_FORBIDDEN';
  end if;
end;
$$;

-- Pickup only -- a delivery order at 'ready' moves on via the rider
-- functions below instead.
create or replace function public.complete_pickup_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.orders
     set status = 'completed'
   where id = p_order_id
     and status = 'ready'
     and delivery_type = 'pickup'
     and store_id in (select id from public.stores where owner_id = auth.uid());

  if not found then
    raise exception 'STALE_OR_FORBIDDEN';
  end if;
end;
$$;

-- Cancellable from pending/confirmed/ready; restocks every line item
-- atomically with the status change (D3 in implementation-plan.md).
create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.orders
     set status = 'cancelled'
   where id = p_order_id
     and status in ('pending', 'confirmed', 'ready')
     and store_id in (select id from public.stores where owner_id = auth.uid());

  if not found then
    raise exception 'STALE_OR_FORBIDDEN';
  end if;

  for v_item in
    select product_id, quantity from public.order_items where order_id = p_order_id
  loop
    update public.products
       set quantity = quantity + v_item.quantity,
           status   = case when status = 'sold_out' then 'active' else status end
     where id = v_item.product_id;
  end loop;
end;
$$;

revoke all on function public.confirm_order(uuid)        from public, anon;
revoke all on function public.mark_order_ready(uuid)      from public, anon;
revoke all on function public.complete_pickup_order(uuid) from public, anon;
revoke all on function public.cancel_order(uuid)          from public, anon;
grant execute on function public.confirm_order(uuid)        to authenticated;
grant execute on function public.mark_order_ready(uuid)      to authenticated;
grant execute on function public.complete_pickup_order(uuid) to authenticated;
grant execute on function public.cancel_order(uuid)          to authenticated;

-- Rider workflow. [migration-m7-rider-delivery.sql]

create or replace function public.set_rider_shift(p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_status not in ('available', 'offline') then
    raise exception 'BAD_STATUS';
  end if;

  update public.riders
     set status = p_status
   where id = auth.uid()
     and status <> 'busy';

  if not found then
    raise exception 'RIDER_BUSY_OR_NOT_FOUND';
  end if;
end;
$$;

-- One guarded UPDATE decides the race -- never read-then-write.
create or replace function public.claim_delivery_job(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1 from public.riders
    where id = auth.uid() and verified = true and status = 'available'
  ) then
    raise exception 'RIDER_NOT_AVAILABLE';
  end if;

  update public.orders
     set rider_id = auth.uid(),
         status   = 'rider_assigned'
   where id = p_order_id
     and rider_id is null
     and status = 'ready'
     and delivery_type = 'delivery';

  if not found then
    raise exception 'JOB_ALREADY_TAKEN';
  end if;

  update public.riders set status = 'busy' where id = auth.uid();
end;
$$;

create or replace function public.mark_picked_up(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.orders
     set status = 'picked_up'
   where id = p_order_id
     and status = 'rider_assigned'
     and rider_id = auth.uid();

  if not found then
    raise exception 'STALE_OR_FORBIDDEN';
  end if;
end;
$$;

create or replace function public.mark_delivering(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.orders
     set status = 'delivering'
   where id = p_order_id
     and status = 'picked_up'
     and rider_id = auth.uid();

  if not found then
    raise exception 'STALE_OR_FORBIDDEN';
  end if;
end;
$$;

create or replace function public.mark_delivered(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.orders
     set status = 'completed'
   where id = p_order_id
     and status = 'delivering'
     and rider_id = auth.uid();

  if not found then
    raise exception 'STALE_OR_FORBIDDEN';
  end if;

  update public.riders set status = 'available' where id = auth.uid();
end;
$$;

revoke all on function public.set_rider_shift(text)      from public, anon;
revoke all on function public.claim_delivery_job(uuid)    from public, anon;
revoke all on function public.mark_picked_up(uuid)        from public, anon;
revoke all on function public.mark_delivering(uuid)       from public, anon;
revoke all on function public.mark_delivered(uuid)        from public, anon;
grant execute on function public.set_rider_shift(text)      to authenticated;
grant execute on function public.claim_delivery_job(uuid)    to authenticated;
grant execute on function public.mark_picked_up(uuid)        to authenticated;
grant execute on function public.mark_delivering(uuid)       to authenticated;
grant execute on function public.mark_delivered(uuid)        to authenticated;


-- #######################################################################
-- # 8. shares (community donation) + share_claims + foundations
-- #######################################################################
alter table public.shares enable row level security;

-- Replaces: migration-m8-shares.sql's version (shares_select_own,
-- store-owner only -- the public /shares donation feed needs everyone to
-- see it, same spirit as the product catalog).
-- [FINAL: migration-fix-public-shares.sql]
drop policy if exists "shares_select_own" on public.shares;
drop policy if exists "shares_select_public" on public.shares;
create policy "shares_select_public" on public.shares
  for select using (true);

-- Sharing diverts a product's *entire* remaining stock: status flips to
-- 'shared' and the shares log records however much was on hand (also as
-- `remaining`, the claimable pool) -- both writes in one transaction.
-- Replaces: migration-m8-shares.sql's 1-arg version (no pickup note, no
-- expiry check) and migration-share-claims.sql's 2-arg version (no
-- foundation). With p_foundation_id the whole lot is earmarked for that
-- foundation: remaining = 0, so claim_share() can never touch it.
-- [FINAL: migration-foundations.sql]
drop function if exists public.share_product(uuid);
drop function if exists public.share_product(uuid, text);

create or replace function public.share_product(
  p_product_id uuid,
  p_pickup_note text default null,
  p_foundation_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qty    int;
  v_store  uuid;
  v_expiry timestamptz;
  v_note   text := nullif(btrim(coalesce(p_pickup_note, '')), '');
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select quantity, store_id, expiry_date into v_qty, v_store, v_expiry
    from public.products
   where id = p_product_id
     and status = 'active'
     and store_id in (select id from public.stores where owner_id = auth.uid())
   for update;

  if not found then
    raise exception 'NOT_FOUND_OR_FORBIDDEN';
  end if;
  if v_qty <= 0 then
    raise exception 'NOTHING_TO_SHARE';
  end if;
  if v_expiry <= now() then
    raise exception 'PRODUCT_EXPIRED';
  end if;
  if v_note is not null and char_length(v_note) > 200 then
    raise exception 'NOTE_TOO_LONG';
  end if;
  if p_foundation_id is not null and not exists (
    select 1 from public.foundations where id = p_foundation_id and active
  ) then
    raise exception 'FOUNDATION_UNAVAILABLE';
  end if;

  update public.products set status = 'shared' where id = p_product_id;

  insert into public.shares (store_id, product_id, quantity, remaining, pickup_note, foundation_id)
  values (
    v_store, p_product_id, v_qty,
    case when p_foundation_id is null then v_qty else 0 end,
    v_note, p_foundation_id
  );
end;
$$;

revoke all on function public.share_product(uuid, text, uuid) from public, anon;
grant execute on function public.share_product(uuid, text, uuid) to authenticated;


-- share_claims: consumers receiving community-shared food.
-- [migration-share-claims.sql]
alter table public.share_claims enable row level security;

-- Claimer sees their own, the donating store sees claims on its shares,
-- admin sees everything. No insert/update/delete policy -- the three
-- SECURITY DEFINER functions below are the only write path.
drop policy if exists "share_claims_select_related" on public.share_claims;
create policy "share_claims_select_related" on public.share_claims
  for select using (
    claimer_id = auth.uid()
    or exists (
      select 1 from public.shares s
      where s.id = share_claims.share_id
        and s.store_id in (select id from public.stores where owner_id = auth.uid())
    )
    or public.is_admin()
  );

-- claim_share(): consumer reserves 1-5 pieces
-- ---------------------------------------------------------------------
create or replace function public.claim_share(p_share_id uuid, p_quantity int)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining int;
  v_expiry    timestamptz;
  v_verified  boolean;
  v_claim_id  uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'consumer' and suspended = false
  ) then
    raise exception 'CONSUMER_ONLY';
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 5 then
    raise exception 'BAD_QUANTITY';
  end if;

  -- Lock the share row: concurrent claims on the same donation serialize
  -- here, so `remaining` can never be over-allocated.
  select s.remaining, p.expiry_date, st.verified
    into v_remaining, v_expiry, v_verified
    from public.shares s
    join public.products p on p.id = s.product_id
    join public.stores  st on st.id = s.store_id
   where s.id = p_share_id
   for update of s;

  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_expiry <= now() then
    raise exception 'SHARE_EXPIRED';
  end if;
  if not v_verified then
    raise exception 'STORE_UNAVAILABLE';
  end if;
  if exists (
    select 1 from public.share_claims
    where share_id = p_share_id and claimer_id = auth.uid() and status <> 'cancelled'
  ) then
    raise exception 'ALREADY_CLAIMED';
  end if;
  if v_remaining < p_quantity then
    raise exception 'NOT_ENOUGH_LEFT';
  end if;

  update public.shares set remaining = remaining - p_quantity where id = p_share_id;

  insert into public.share_claims (share_id, claimer_id, quantity)
  values (p_share_id, auth.uid(), p_quantity)
  returning id into v_claim_id;

  return v_claim_id;
end;
$$;

revoke all on function public.claim_share(uuid, int) from public, anon;
grant execute on function public.claim_share(uuid, int) to authenticated;


-- cancel_share_claim(): claimer or donating store; stock returns
-- ---------------------------------------------------------------------
create or replace function public.cancel_share_claim(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share_id uuid;
  v_claimer  uuid;
  v_qty      int;
  v_status   text;
  v_store    uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select share_id into v_share_id from public.share_claims where id = p_claim_id;
  if not found then
    raise exception 'NOT_FOUND_OR_FORBIDDEN';
  end if;

  -- Lock order: share, then claim (claim_share locks the share first too).
  select store_id into v_store from public.shares where id = v_share_id for update;

  select claimer_id, quantity, status into v_claimer, v_qty, v_status
    from public.share_claims where id = p_claim_id for update;

  if v_claimer <> auth.uid()
     and v_store not in (select id from public.stores where owner_id = auth.uid()) then
    raise exception 'NOT_FOUND_OR_FORBIDDEN';
  end if;
  if v_status <> 'reserved' then
    raise exception 'NOT_RESERVED';
  end if;

  update public.share_claims
     set status = 'cancelled', resolved_at = now()
   where id = p_claim_id;

  update public.shares set remaining = remaining + v_qty where id = v_share_id;
end;
$$;

revoke all on function public.cancel_share_claim(uuid) from public, anon;
grant execute on function public.cancel_share_claim(uuid) to authenticated;


-- mark_share_collected(): donating store confirms hand-over
-- ---------------------------------------------------------------------
create or replace function public.mark_share_collected(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.share_claims c
     set status = 'collected', resolved_at = now()
    from public.shares s
   where c.id = p_claim_id
     and s.id = c.share_id
     and s.store_id in (select id from public.stores where owner_id = auth.uid())
     and c.status = 'reserved';

  if not found then
    raise exception 'NOT_FOUND_OR_NOT_RESERVED';
  end if;
end;
$$;

revoke all on function public.mark_share_collected(uuid) from public, anon;
grant execute on function public.mark_share_collected(uuid) to authenticated;


-- community_share_stats(): public aggregates for /shares
-- ---------------------------------------------------------------------
-- SECURITY DEFINER because collected totals come from share_claims, which
-- is not publicly readable row-by-row -- only these sums are exposed.
create or replace function public.community_share_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'total_quantity',     (select coalesce(sum(quantity), 0) from public.shares),
    'store_count',        (select count(distinct store_id) from public.shares),
    'collected_quantity', (select coalesce(sum(quantity), 0)
                             from public.share_claims where status = 'collected'),
    'foundation_delivered_quantity',
                          (select coalesce(sum(quantity), 0)
                             from public.shares where delivered_at is not null),
    'available_quantity', (select coalesce(sum(s.remaining), 0)
                             from public.shares s
                             join public.products p on p.id = s.product_id
                             join public.stores  st on st.id = s.store_id
                            where p.expiry_date > now() and st.verified),
    'by_category', coalesce((
      select json_agg(json_build_object('category', category, 'quantity', qty)
                      order by qty desc)
        from (
          select p.category, sum(s.quantity) as qty
            from public.shares s
            join public.products p on p.id = s.product_id
           group by p.category
        ) t
    ), '[]'::json),
    'foundations', coalesce((
      select json_agg(json_build_object(
               'id', f.id, 'name', f.name, 'description', f.description,
               'delivered_quantity', coalesce(d.qty, 0))
             order by coalesce(d.qty, 0) desc, f.name)
        from public.foundations f
        left join (
          select foundation_id, sum(quantity) as qty
            from public.shares
           where delivered_at is not null
           group by foundation_id
        ) d on d.foundation_id = f.id
       where f.active
    ), '[]'::json)
  );
$$;

revoke all on function public.community_share_stats() from public;
grant execute on function public.community_share_stats() to anon, authenticated;


-- Expiry job: auto-cancel stale donation claims, expire products.
-- Scheduled by pg_cron every 10 min. [migration-claim-timeout-and-store-logo.sql]
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


-- foundations: admin-managed donation recipients (no user accounts).
-- [migration-foundations.sql]
alter table public.foundations enable row level security;

-- Foundations are public organisations: everyone may read the list (the
-- feed shows "given to <foundation>" even after one is deactivated).
-- Pickers filter on active = true. No write policy -- admin_save_foundation()
-- is the only write path.
drop policy if exists "foundations_select_public" on public.foundations;
create policy "foundations_select_public" on public.foundations
  for select using (true);

-- Admin create (p_id null) / edit. [migration-foundations.sql]
create or replace function public.admin_save_foundation(
  p_id uuid,
  p_name text,
  p_description text,
  p_address text,
  p_phone text,
  p_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY';
  end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'NAME_REQUIRED';
  end if;

  if p_id is null then
    insert into public.foundations (name, description, address, phone, active)
    values (
      btrim(p_name),
      nullif(btrim(coalesce(p_description, '')), ''),
      nullif(btrim(coalesce(p_address, '')), ''),
      nullif(btrim(coalesce(p_phone, '')), ''),
      coalesce(p_active, true)
    )
    returning id into v_id;
  else
    update public.foundations
       set name        = btrim(p_name),
           description = nullif(btrim(coalesce(p_description, '')), ''),
           address     = nullif(btrim(coalesce(p_address, '')), ''),
           phone       = nullif(btrim(coalesce(p_phone, '')), ''),
           active      = coalesce(p_active, active)
     where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'NOT_FOUND';
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.admin_save_foundation(uuid, text, text, text, text, boolean) from public, anon;
grant execute on function public.admin_save_foundation(uuid, text, text, text, text, boolean) to authenticated;

-- Donating store confirms a foundation-earmarked share was handed over.
-- [migration-foundations.sql]
create or replace function public.mark_foundation_delivered(p_share_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.shares
     set delivered_at = now()
   where id = p_share_id
     and foundation_id is not null
     and delivered_at is null
     and store_id in (select id from public.stores where owner_id = auth.uid());

  if not found then
    raise exception 'NOT_FOUND_OR_ALREADY_DELIVERED';
  end if;
end;
$$;

revoke all on function public.mark_foundation_delivered(uuid) from public, anon;
grant execute on function public.mark_foundation_delivered(uuid) to authenticated;


-- #######################################################################
-- # 9. Admin moderation + platform metrics
-- #######################################################################
-- Moderation writes -- direct client writes to verified/suspended stay
-- blocked by the owner-scoped UPDATE policies above; these functions are
-- the only way to flip the flag for a row you don't own.
-- [migration-m9-admin.sql]

create or replace function public.admin_set_store_verified(p_store_id uuid, p_verified boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY';
  end if;

  update public.stores set verified = p_verified where id = p_store_id;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
end;
$$;

create or replace function public.admin_set_rider_verified(p_rider_id uuid, p_verified boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY';
  end if;

  update public.riders set verified = p_verified where id = p_rider_id;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
end;
$$;

create or replace function public.admin_set_user_suspended(p_user_id uuid, p_suspended boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'CANNOT_SUSPEND_SELF';
  end if;

  update public.profiles set suspended = p_suspended where id = p_user_id;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.admin_set_store_verified(uuid, boolean) from public, anon;
revoke all on function public.admin_set_rider_verified(uuid, boolean) from public, anon;
revoke all on function public.admin_set_user_suspended(uuid, boolean) from public, anon;
grant execute on function public.admin_set_store_verified(uuid, boolean) to authenticated;
grant execute on function public.admin_set_rider_verified(uuid, boolean) to authenticated;
grant execute on function public.admin_set_user_suspended(uuid, boolean) to authenticated;

-- profiles has no email column (it lives on auth.users, which PostgREST
-- never exposes directly) -- this RPC is the only way the admin user list
-- can show it. Every signed-up user appears immediately regardless of role
-- or verified status; verified only gates stores/riders being publicly
-- listed/assignable, never whether admin can see the account.
-- [fix-profiles-visibility.sql]
create or replace function public.admin_list_users()
returns table (
  id uuid,
  role text,
  full_name text,
  phone text,
  email text,
  suspended boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY';
  end if;

  return query
    select p.id, p.role, p.full_name, p.phone, u.email, p.suspended, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- One aggregate RPC instead of loosening orders/order_items RLS for
-- admin-wide row-level reads. [migration-m9-admin.sql]
create or replace function public.admin_platform_metrics()
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
    'stores_total', (select count(*) from public.stores),
    'stores_verified', (select count(*) from public.stores where verified = true),
    'riders_total', (select count(*) from public.riders),
    'riders_verified', (select count(*) from public.riders where verified = true),
    'consumers_total', (select count(*) from public.profiles where role = 'consumer'),
    'users_suspended', (select count(*) from public.profiles where suspended = true),
    'orders_by_status', (
      select coalesce(jsonb_object_agg(status, cnt), '{}'::jsonb)
      from (select status, count(*) as cnt from public.orders group by status) s
    ),
    'shares_quantity_total', (select coalesce(sum(quantity), 0) from public.shares),
    'delivered_items_quantity_total', (
      select coalesce(sum(oi.quantity), 0)
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where o.status = 'completed'
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_platform_metrics() from public, anon;
grant execute on function public.admin_platform_metrics() to authenticated;

-- Per-store revenue + commission (COMMISSION_RATE 0.10 is a placeholder --
-- see implementation-plan.md M11's note; there's no real commission/billing
-- concept anywhere else in this Cash-on-Delivery app).
-- [migration-fix-admin-store-sales.sql]
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


-- #######################################################################
-- # 10. reviews (store + rider ratings)
-- #######################################################################
alter table public.reviews enable row level security;

-- [migration-m11-reviews.sql]
drop policy if exists "reviews_select_public" on public.reviews;
create policy "reviews_select_public" on public.reviews
  for select using (true);

-- Replaces: migration-m11-reviews.sql's version (store_id required, no
-- p_target, only ever one review per order). A delivery order can now
-- carry up to two reviews (one per target) -- see the two partial unique
-- indexes on public.reviews in the schema (reviews_order_store_uniq,
-- reviews_order_rider_uniq from migration-fix-rider-reviews.sql).
-- [FINAL: migration-fix-rider-reviews.sql]
drop function if exists public.submit_review(uuid, int, text);

create or replace function public.submit_review(
  p_order_id uuid,
  p_target   text,   -- 'store' | 'rider'
  p_rating   int,
  p_comment  text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consumer  uuid := auth.uid();
  v_order     public.orders%rowtype;
  v_review_id uuid;
  v_comment   text := nullif(trim(coalesce(p_comment, '')), '');
begin
  if v_consumer is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_rating < 1 or p_rating > 5 then
    raise exception 'BAD_RATING';
  end if;
  if p_target not in ('store', 'rider') then
    raise exception 'BAD_TARGET';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.consumer_id <> v_consumer then
    raise exception 'NOT_YOUR_ORDER';
  end if;
  if v_order.status <> 'completed' then
    raise exception 'ORDER_NOT_COMPLETED';
  end if;

  if p_target = 'store' then
    if exists (select 1 from public.reviews where order_id = p_order_id and store_id is not null) then
      raise exception 'ALREADY_REVIEWED';
    end if;
    insert into public.reviews (order_id, consumer_id, store_id, rating, comment)
    values (p_order_id, v_consumer, v_order.store_id, p_rating, v_comment)
    returning id into v_review_id;
  else
    if v_order.rider_id is null then
      raise exception 'NO_RIDER_ON_ORDER';
    end if;
    if exists (select 1 from public.reviews where order_id = p_order_id and rider_id is not null) then
      raise exception 'ALREADY_REVIEWED';
    end if;
    insert into public.reviews (order_id, consumer_id, rider_id, rating, comment)
    values (p_order_id, v_consumer, v_order.rider_id, p_rating, v_comment)
    returning id into v_review_id;
  end if;

  return v_review_id;
end;
$$;

revoke all on function public.submit_review(uuid, text, int, text) from public, anon;
grant execute on function public.submit_review(uuid, text, int, text) to authenticated;


-- #######################################################################
-- # 11. push_subscriptions (web push) -- REMOVED 2026-09-22
-- #######################################################################
-- M12 (web push notifications) was built, DB-confirmed, then torn out
-- entirely at the user's request right after M11 passed QA. The table and
-- both RPCs below no longer exist -- see docs/migration-remove-push.sql for
-- the drop, and implementation-plan.md's M12 section for what was removed.
-- This section intentionally left as a marker only; nothing to run here.


-- #######################################################################
-- # 11b. Column-level write privileges
-- #######################################################################
-- The *_update_own / *_insert_own policies above only pick the row; without
-- these grants a user could set their own role = 'admin', lift their own
-- suspension, or self-verify a store/rider via the REST API. Privileged
-- flags are written only by SECURITY DEFINER functions; rows are created
-- only by handle_new_user(). [migration-fix-column-privileges.sql]
revoke insert, update on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

revoke insert, update on public.stores from anon, authenticated;
grant update (name, address, phone, latitude, longitude, delivery_fee, logo_url)
  on public.stores to authenticated;

revoke insert, update on public.riders from anon, authenticated;


-- #######################################################################
-- # 12. Realtime
-- #######################################################################
-- Only `orders` is on Realtime (the consumer's own order-tracking page,
-- M5) -- everything else (Job Pool, moderation tables) refreshes via
-- Server Action revalidation (D6 in implementation-plan.md), not Realtime.
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


-- #######################################################################
-- # 13. Verify -- one full audit query, last statement so it auto-shows
-- #######################################################################
select 'policy' as kind, tablename as on_table, policyname as name
  from pg_policies
 where schemaname = 'public'
    or (schemaname = 'storage' and tablename = 'objects' and policyname like 'product_images%')
union all
select 'function', 'public', proname
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in (
     'is_admin', 'handle_new_user', 'place_order', 'confirm_order',
     'mark_order_ready', 'complete_pickup_order', 'cancel_order',
     'set_rider_shift', 'claim_delivery_job', 'mark_picked_up',
     'mark_delivering', 'mark_delivered', 'share_product',
     'admin_set_store_verified', 'admin_set_rider_verified',
     'admin_set_user_suspended', 'admin_platform_metrics',
     'admin_store_sales_report', 'admin_list_users', 'submit_review',
     'update_product', 'claim_share', 'cancel_share_claim',
     'mark_share_collected', 'community_share_stats',
     'admin_save_foundation', 'mark_foundation_delivered',
     'reviewer_names', 'run_expiry_jobs'
   )
order by kind, on_table, name;
-- Expect 27 policy rows + 21 function rows (48 total): 50 after M11/M12,
-- minus 3 for removing push_subscriptions (1 policy + 2 functions), plus 1
-- for update_product (migration-fix-product-update-race.sql).
-- migration-share-claims.sql adds 3 policies (share_claims_select_related,
-- products_select_shared, profiles_select_share_claimer) + 4 functions
-- (claim_share, cancel_share_claim, mark_share_collected,
-- community_share_stats) -> 30 policy rows + 25 function rows (55 total).
-- migration-foundations.sql adds 1 policy (foundations_select_public) + 2
-- functions (admin_save_foundation, mark_foundation_delivered)
-- -> 31 policy rows + 27 function rows (58 total).
-- migration-fix-reviewer-privacy.sql drops profiles_select_reviewer and
-- adds reviewer_names() -> 30 policy rows + 28 function rows (58 total).
-- migration-claim-timeout-and-store-logo.sql adds run_expiry_jobs()
-- -> 30 policy rows + 29 function rows (59 total).
-- Cross-check against the section headers above if any are missing.
