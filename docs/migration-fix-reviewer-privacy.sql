-- =====================================================================
-- Fix: reviewer phone numbers readable by anyone (privacy leak)
-- Run in Supabase Dashboard > SQL Editor. Safe to run more than once.
--
-- profiles_select_reviewer (migration-fix-profiles-visibility.sql) made
-- the WHOLE profiles row of every consumer who wrote a review readable by
-- everyone, logged out included -- so full_name AND phone could be pulled
-- straight from the REST API with the public anon key. The app only ever
-- needed the reviewer's display name.
--
-- Fix: drop that row policy and expose names only through a SECURITY
-- DEFINER function that returns (id, display_name) for ids that actually
-- wrote a review -- passing any other user id returns nothing. The display
-- name is abbreviated (first name + surname initial).
-- =====================================================================

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

-- Verify -- last statement, so the SQL Editor shows it after Run.
select 'policy still present (should be 0)' as check_item,
       count(*)::text as result
  from pg_policies
 where schemaname = 'public' and policyname = 'profiles_select_reviewer'
union all
select 'function reviewer_names exists', count(*)::text
  from pg_proc
 where pronamespace = 'public'::regnamespace and proname = 'reviewer_names'
union all
select 'anon can execute reviewer_names',
       has_function_privilege('anon', 'public.reviewer_names(uuid[])', 'execute')::text
union all
select 'sample: ' || full_name, (select display_name from public.reviewer_names(array[id]))
  from (select distinct p.id, p.full_name
          from public.profiles p join public.reviews r on r.consumer_id = p.id
         limit 3) s;
-- Expect: 0, 1, true, then up to 3 "sample" rows showing each reviewer's
-- full name -> abbreviated name (e.g. "สมใจ บุญรอด" -> "สมใจ บ.").
