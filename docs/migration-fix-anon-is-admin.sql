-- =====================================================================
-- Fix: logged-out visitors get "permission denied for function is_admin"
-- Run in Supabase Dashboard > SQL Editor. Safe to run more than once.
--
-- migration-m9-admin.sql revoked EXECUTE on is_admin() from anon. But
-- several SELECT policies call it (profiles_select_admin,
-- riders_select_admin, share_claims_select_related), and RLS policies on
-- one table reach others through subqueries -- e.g. products_select_order_related
-- -> order_items -> orders -> riders. Postgres checks EXECUTE permission on
-- every function in that plan, so for the anon role the *entire* query
-- fails, even when another policy (products_select_public) would allow
-- the row. Result: the public catalog, home page and /shares were empty
-- or erroring for anyone not logged in.
--
-- Granting EXECUTE to anon is safe: is_admin() only checks
-- profiles.role = 'admin' for auth.uid(), which is NULL for anon, so it
-- always returns false for them.
-- =====================================================================

grant execute on function public.is_admin() to anon;

-- Verify -- last statement, so the SQL Editor shows it after Run.
select r.rolname as role,
       has_function_privilege(r.rolname, 'public.is_admin()', 'execute') as can_execute
  from pg_roles r
 where r.rolname in ('anon', 'authenticated')
 order by r.rolname;
-- Expect 2 rows, both can_execute = true.
