-- =====================================================================
-- Migration M9: admin moderation (verify/suspend) and platform metrics
-- Run in Supabase Dashboard > SQL Editor. Safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. is_admin() helper -- SECURITY DEFINER so it reads profiles without
--    going through profiles' own RLS (avoids self-referencing policy
--    subtleties). Used by every policy/function below.
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------
-- 2. Admin-wide SELECT so moderation tables can list every row.
--    (stores already has "stores_select_all" from M1 -- no change needed.)
-- ---------------------------------------------------------------------
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles
  for select using (public.is_admin());

drop policy if exists "riders_select_admin" on public.riders;
create policy "riders_select_admin" on public.riders
  for select using (public.is_admin());

-- ---------------------------------------------------------------------
-- 3. Moderation writes -- SECURITY DEFINER, matching the M4/M6/M7 pattern.
--    Direct client writes to these flags remain blocked by the owner-scoped
--    UPDATE policies already in place (stores_update_own, riders_update_own,
--    profiles_update_own); these functions are the only way to flip them
--    for a row you don't own.
-- ---------------------------------------------------------------------
create or replace function public.admin_set_store_verified(p_store_id uuid, p_verified boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY';
  end if;

  update public.stores set verified = p_verified where id = p_store_id;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
end;
$$;

create or replace function public.admin_set_rider_verified(p_rider_id uuid, p_verified boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY';
  end if;

  update public.riders set verified = p_verified where id = p_rider_id;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
end;
$$;

create or replace function public.admin_set_user_suspended(p_user_id uuid, p_suspended boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'CANNOT_SUSPEND_SELF';
  end if;

  update public.profiles set suspended = p_suspended where id = p_user_id;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.admin_set_store_verified(uuid, boolean) from public, anon;
revoke all on function public.admin_set_rider_verified(uuid, boolean) from public, anon;
revoke all on function public.admin_set_user_suspended(uuid, boolean) from public, anon;
grant execute on function public.admin_set_store_verified(uuid, boolean) to authenticated;
grant execute on function public.admin_set_rider_verified(uuid, boolean) to authenticated;
grant execute on function public.admin_set_user_suspended(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Platform metrics -- one aggregate RPC instead of loosening orders /
--    order_items RLS for admin-wide row-level reads.
-- ---------------------------------------------------------------------
create or replace function public.admin_platform_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY';
  end if;

  select jsonb_build_object(
    'stores_total', (select count(*) from public.stores),
    'stores_verified', (select count(*) from public.stores where verified = true),
    'riders_total', (select count(*) from public.riders),
    'riders_verified', (select count(*) from public.riders where verified = true),
    'consumers_total', (select count(*) from public.profiles where role = 'consumer'),
    'users_suspended', (select count(*) from public.profiles where suspended = true),
    'orders_by_status', (
      select coalesce(jsonb_object_agg(status, cnt), '{}'::jsonb)
      from (select status, count(*) as cnt from public.orders group by status) s
    ),
    'shares_quantity_total', (select coalesce(sum(quantity), 0) from public.shares),
    'delivered_items_quantity_total', (
      select coalesce(sum(oi.quantity), 0)
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where o.status = 'completed'
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_platform_metrics() from public, anon;
grant execute on function public.admin_platform_metrics() to authenticated;

-- Verify -- this SELECT is the file's last statement, so the SQL Editor's
-- result panel shows it automatically after Run.
select 'function: ' || proname as check_item, 'exists' as detail
  from pg_proc where proname like 'admin_%' or proname = 'is_admin'
union all
select 'policy: ' || policyname, cmd::text
  from pg_policies where policyname like '%_admin';
-- Expect 7 rows: 5 functions (is_admin + 4 admin_*) + 2 policies.
