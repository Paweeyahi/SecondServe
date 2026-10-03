-- =====================================================================
-- Migration M2: products table, RLS, and the 'products' Storage bucket
-- Run in Supabase Dashboard > SQL Editor. Safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. products table (matches docs/database.md)
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references public.stores(id) on delete cascade,
  name           text not null check (char_length(trim(name)) > 0),
  category       text not null check (category in ('fresh','bakery','beverage','dry','ready_meal')),
  original_price numeric(10,2) not null check (original_price > 0),
  discount_price numeric(10,2) not null check (discount_price >= 0 and discount_price < original_price),
  quantity       integer not null default 0 check (quantity >= 0),
  expiry_date    timestamptz not null,
  image_url      text not null,
  status         text not null default 'active' check (status in ('active','sold_out','expired','shared')),
  created_at     timestamptz not null default now()
);

-- Bring an older products table up to the M2 category rule if needed
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'products') then
    alter table public.products drop constraint if exists products_category_check;
    alter table public.products add  constraint products_category_check
      check (category in ('fresh','bakery','beverage','dry','ready_meal'));
  end if;
end $$;

create index if not exists idx_products_catalog on public.products (status, expiry_date);
create index if not exists idx_products_store   on public.products (store_id);

-- ---------------------------------------------------------------------
-- 2. RLS on products
-- ---------------------------------------------------------------------
alter table public.products enable row level security;

-- Public catalog: active, in-stock items from verified stores (M3 relies on this)
drop policy if exists "products_select_public" on public.products;
create policy "products_select_public" on public.products
  for select using (
    status = 'active'
    and quantity > 0
    and exists (
      select 1 from public.stores s
      where s.id = products.store_id and s.verified = true
    )
  );

-- A store owner sees every one of their own products (any status)
drop policy if exists "products_select_own" on public.products;
create policy "products_select_own" on public.products
  for select using (
    store_id in (select id from public.stores where owner_id = auth.uid())
  );

drop policy if exists "products_insert_own" on public.products;
create policy "products_insert_own" on public.products
  for insert with check (
    store_id in (select id from public.stores where owner_id = auth.uid())
  );

drop policy if exists "products_update_own" on public.products;
create policy "products_update_own" on public.products
  for update using (
    store_id in (select id from public.stores where owner_id = auth.uid())
  );

drop policy if exists "products_delete_own" on public.products;
create policy "products_delete_own" on public.products
  for delete using (
    store_id in (select id from public.stores where owner_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- 3. Storage bucket 'products' (public read, store-only writes)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do update set public = true;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read" on storage.objects
  for select using (bucket_id = 'products');

drop policy if exists "product_images_store_insert" on storage.objects;
create policy "product_images_store_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'products'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'store')
  );

drop policy if exists "product_images_store_update" on storage.objects;
create policy "product_images_store_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'products'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'store')
  );

drop policy if exists "product_images_store_delete" on storage.objects;
create policy "product_images_store_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'products'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'store')
  );

-- ---------------------------------------------------------------------
-- 4. Verify
-- ---------------------------------------------------------------------
-- select policyname, cmd from pg_policies where tablename = 'products';
-- select id, public from storage.buckets where id = 'products';
