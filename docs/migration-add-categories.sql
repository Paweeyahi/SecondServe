-- =====================================================================
-- Add product categories (2026-10-04)
-- Run in Supabase Dashboard > SQL Editor. Safe to run more than once.
--
-- New: produce (ผักและผลไม้), meat_seafood (เนื้อสัตว์และอาหารทะเล),
--      dairy (นมและผลิตภัณฑ์นม), frozen (อาหารแช่แข็ง), snacks (ขนมและของหวาน).
-- Existing keys are unchanged, so no product needs migrating; 'fresh'
-- keeps its label "อาหารสด".
-- Keep in sync with PRODUCT_CATEGORIES in src/types/product.ts.
-- =====================================================================

alter table public.products drop constraint if exists products_category_check;
alter table public.products add constraint products_category_check
  check (category in (
    'fresh', 'bakery', 'beverage', 'dry', 'ready_meal',
    'produce', 'meat_seafood', 'dairy', 'frozen', 'snacks'
  ));

-- Verify -- last statement, so the SQL Editor shows it after Run.
select conname, pg_get_constraintdef(oid) as definition
  from pg_constraint
 where conrelid = 'public.products'::regclass and conname = 'products_category_check';
-- Expect 1 row whose definition lists all 10 categories.
