-- =====================================================================
-- Fix: admin "users" page showed 0 users.
-- admin_list_users() declares `email text`, but auth.users.email is
-- varchar(255), so every call failed with "structure of query does not
-- match function result type" and the page swallowed the error.
-- Cast to text. Run in Supabase Dashboard > SQL Editor. Safe to re-run.
-- =====================================================================

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

-- Verify -- last statement, so the SQL Editor shows it after Run.
select pg_get_functiondef('public.admin_list_users()'::regprocedure) like '%u.email::text%' as fixed;
-- Expect 1 row: fixed = true.
