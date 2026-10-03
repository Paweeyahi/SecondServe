-- =====================================================================
-- Fix: public community-donation feed
-- Run in Supabase Dashboard > SQL Editor. Safe to run more than once.
--
-- M8 (migration-m8-shares.sql) only let a store see its own shares log
-- ("shares_select_own"). The Navbar's "ส่งต่ออาหารชุมชน" link always
-- pointed at a public page that was never built, so this adds the public
-- read policy that page needs -- anyone (including logged-out visitors,
-- same as the product catalog) can see what's been shared: store name,
-- product name/image, quantity, and when. No personal data is exposed.
-- =====================================================================

drop policy if exists "shares_select_own" on public.shares;
drop policy if exists "shares_select_public" on public.shares;
create policy "shares_select_public" on public.shares
  for select using (true);

-- Verify -- this SELECT is the file's last statement, so the SQL Editor's
-- result panel shows it automatically after Run.
select policyname as check_item, cmd::text as detail
  from pg_policies where tablename = 'shares';
-- Expect 1 row: shares_select_public.
