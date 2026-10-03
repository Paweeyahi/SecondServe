-- =====================================================================
-- Fix: anyone could sign up as an admin
-- Run in Supabase Dashboard > SQL Editor. Safe to run more than once.
--
-- handle_new_user() copied raw_user_meta_data->>'role' straight into
-- profiles.role. That metadata is chosen by whoever calls signup, and the
-- public /auth/v1/signup endpoint is open (email auto-confirm is on), so a
-- single API call with {"role":"admin"} produced a working admin account.
-- The register page only *offers* consumer/store/rider -- that was a UI
-- restriction, not a security boundary.
--
-- Fix: the trigger now accepts only consumer / store / rider; anything else
-- (including 'admin') becomes 'consumer'. Promote a real admin with:
--   update public.profiles set role = 'admin'
--    where id = (select id from auth.users where email = '...');
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Signup metadata is client-controlled (anyone can call the public
  -- /auth/v1/signup API directly), so only self-service roles are honoured;
  -- 'admin' or anything unexpected becomes a plain consumer. Admins are
  -- promoted afterwards with service-role / SQL access only.
  v_role  text := case
                    when new.raw_user_meta_data->>'role' in ('consumer', 'store', 'rider')
                      then new.raw_user_meta_data->>'role'
                    else 'consumer'
                  end;
  v_name  text := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'ผู้ใช้ใหม่');
  v_phone text := coalesce(nullif(trim(new.raw_user_meta_data->>'phone'), ''), '000000000');
begin
  insert into public.profiles (id, role, full_name, phone)
  values (new.id, v_role, v_name, v_phone)
  on conflict (id) do nothing;

  if v_role = 'store' then
    insert into public.stores (owner_id, name, address, latitude, longitude, phone)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data->>'store_name'), ''), v_name),
      coalesce(nullif(trim(new.raw_user_meta_data->>'store_address'), ''), 'ยังไม่ได้ระบุที่อยู่ร้านค้า'),
      13.7563,
      100.5018,
      v_phone
    )
    on conflict (owner_id) do nothing;
  end if;

  if v_role = 'rider' then
    insert into public.riders (id, vehicle_type, license_plate, status)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data->>'vehicle_type', ''), 'motorcycle'),
      coalesce(nullif(trim(new.raw_user_meta_data->>'license_plate'), ''), 'รอลงทะเบียน'),
      'offline'
    )
    on conflict (id) do nothing;
  end if;

  return new;
exception
  when others then
    raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
    return new;
end;
$$;

-- Existing admins (to review: every one should be someone you made admin)
-- plus a self-test of the whitelist. Last statement, so it shows after Run.
select 'existing admin' as check_item, u.email as detail, p.created_at::text as created
  from public.profiles p
  join auth.users u on u.id = p.id
 where p.role = 'admin'
union all
select 'trigger whitelists roles',
       (position('in (''consumer'', ''store'', ''rider'')' in pg_get_functiondef('public.handle_new_user()'::regprocedure)) > 0)::text,
       null;
-- Expect: one 'existing admin' row per admin you created on purpose
-- (delete or demote any you don't recognise), and the last row = true.
