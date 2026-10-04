-- =====================================================================
-- Fix (security audit 2026-10-04): product-image folders + fake "shared"
-- Run in Supabase Dashboard > SQL Editor. Safe to run more than once.
--
-- 1. Storage: product_images_store_insert/update/delete only checked
--    "caller is a store", not *which* store. Any store account could
--    overwrite, delete, or plant files in another store's image folder
--    (confirmed in the audit against throwaway audit-* stores only).
--    Images live at products/<store_id>/<uuid>.<ext> (lib/actions/products.ts),
--    so writes are now limited to folders of stores the caller owns.
--
-- 2. products_update_own let a store set status = 'shared' directly,
--    skipping share_product(): the item vanished from sale and showed as
--    "donated" with no shares row, so nobody could ever claim it. It also
--    let a store flip a donated product back to 'active'. Direct updates
--    now can't touch shared products or produce one; share_product() and
--    update_product() are SECURITY DEFINER and unaffected.
-- =====================================================================

-- ---------------------------------------------------------------- 1. storage
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

-- ---------------------------------------------------------------- 2. products
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

-- Verify -- last statement, so the SQL Editor shows it after Run.
select policyname,
       case when coalesce(qual, '') || coalesce(with_check, '') like '%foldername%' then 'folder-scoped'
            when coalesce(qual, '') || coalesce(with_check, '') like '%shared%' then 'blocks shared'
            else 'NOT FIXED' end as state
  from pg_policies
 where policyname in ('product_images_store_insert', 'product_images_store_update',
                      'product_images_store_delete', 'products_update_own')
 order by policyname;
-- Expect 4 rows: three product_images_* = folder-scoped, products_update_own = blocks shared.
