-- Fix: profiles RLS only allowed self + admin to read a row, so any embed like
-- `consumer:profiles!orders_consumer_id_fkey(...)` came back null for the
-- store/rider side of an order (RLS-hidden embed -> null, not an error), and
-- the public reviews list couldn't show the reviewer's name either.

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

drop policy if exists "profiles_select_reviewer" on public.profiles;
create policy "profiles_select_reviewer" on public.profiles
  for select using (
    exists (select 1 from public.reviews r where r.consumer_id = profiles.id)
  );

-- profiles has no email column (it's on auth.users, which PostgREST never
-- exposes) -- this is the only way the admin user list can show it.
-- Every signed-up user appears immediately regardless of role or verified
-- status; verified only gates stores/riders being publicly listed/assignable.
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
    select p.id, p.role, p.full_name, p.phone, u.email::text, p.suspended, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'profiles'
union all
select proname, 'function'
from pg_proc
where pronamespace = 'public'::regnamespace and proname = 'admin_list_users'
order by cmd, policyname;
