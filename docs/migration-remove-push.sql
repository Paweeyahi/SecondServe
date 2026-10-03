-- Removes M12 (web push notifications) from the live database entirely, at
-- the user's explicit request right after M11 passed manual QA. Reverses
-- everything migration-m12-push.sql created: drops the two SECURITY DEFINER
-- lookup functions and the push_subscriptions table (RLS policy on it goes
-- with the table). Do not rerun migration-m12-push.sql after this -- it's
-- kept only as historical record. See implementation-plan.md's M12 section
-- for the matching code-side removal.

drop function if exists public.get_order_push_targets(uuid, text);
drop function if exists public.get_available_rider_push_targets();
drop table if exists public.push_subscriptions;

select 'push_subscriptions table' as object, count(*) as remaining
  from information_schema.tables
 where table_schema = 'public' and table_name = 'push_subscriptions'
union all
select 'get_order_push_targets function', count(*)
  from pg_proc
 where pronamespace = 'public'::regnamespace and proname = 'get_order_push_targets'
union all
select 'get_available_rider_push_targets function', count(*)
  from pg_proc
 where pronamespace = 'public'::regnamespace and proname = 'get_available_rider_push_targets';
-- Expect all three rows to show remaining = 0.
