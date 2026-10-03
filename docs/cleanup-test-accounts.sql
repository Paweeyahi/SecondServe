-- =====================================================================
-- Cleanup: delete the throwaway QA accounts created during testing
-- Run in Supabase Dashboard > SQL Editor. Safe to run more than once.
--
-- Only these six exact emails are touched -- nothing matched by pattern:
--   qa-responsive-consumer / -store / -rider @test.local  (responsive QA, 2026-09-22)
--   qa-login-test / qa-login-store / qa-login-rider @test.local (login debugging, 2026-10-04)
--
-- Deletes child rows first (products -> stores / riders -> profiles ->
-- auth.users) so it works regardless of which foreign keys cascade. If any
-- of these accounts ever placed or received an order, orders' ON DELETE
-- RESTRICT will stop the whole thing and nothing is deleted (it runs as one
-- statement block) -- tell Claude if that happens.
-- =====================================================================

begin;

create temporary table qa_users on commit drop as
  select id, email
    from auth.users
   where email in (
     'qa-responsive-consumer@test.local',
     'qa-responsive-store@test.local',
     'qa-responsive-rider@test.local',
     'qa-login-test@test.local',
     'qa-login-store@test.local',
     'qa-login-rider@test.local'
   );

delete from public.products
 where store_id in (select s.id from public.stores s where s.owner_id in (select id from qa_users));
delete from public.stores   where owner_id in (select id from qa_users);
delete from public.riders   where id       in (select id from qa_users);
delete from public.profiles where id       in (select id from qa_users);
delete from auth.users      where id       in (select id from qa_users);

commit;

-- Verify -- last statement, so the SQL Editor shows it after Run.
select count(*) as qa_accounts_remaining
  from auth.users
 where email like 'qa-%@test.local';
-- Expect 1 row: qa_accounts_remaining = 0.
