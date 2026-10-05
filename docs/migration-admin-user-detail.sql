-- =====================================================================
-- Migration: admin user detail + per-store commission drill-down
-- Run in Supabase Dashboard > SQL Editor. Safe to run more than once.
-- Requires migration-commission.sql (orders.commission_amount).
--
-- Admins have no row-level SELECT on orders (deliberately -- see
-- admin_platform_metrics), so these two read-only SECURITY DEFINER
-- functions return exactly what the admin pages show, admin-only.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. admin_get_user(p_user_id): one user's account + role-specific data
-- ---------------------------------------------------------------------
create or replace function public.admin_get_user(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_result  jsonb;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY';
  end if;

  select * into v_profile from public.profiles where id = p_user_id;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  select jsonb_build_object(
    'id', v_profile.id,
    'role', v_profile.role,
    'full_name', v_profile.full_name,
    'phone', v_profile.phone,
    'suspended', v_profile.suspended,
    'created_at', v_profile.created_at,
    'email', u.email::text,
    'email_confirmed_at', u.email_confirmed_at,
    'last_sign_in_at', u.last_sign_in_at
  ) into v_result
  from auth.users u
  where u.id = p_user_id;

  -- consumer: orders placed, money spent, recent orders, donation claims, reviews
  v_result := v_result || jsonb_build_object(
    'consumer', jsonb_build_object(
      'orders_total', (select count(*) from public.orders where consumer_id = p_user_id),
      'orders_completed', (select count(*) from public.orders where consumer_id = p_user_id and status = 'completed'),
      'spent_total', (select coalesce(sum(total_amount), 0) from public.orders where consumer_id = p_user_id and status = 'completed'),
      'claims_total', (select count(*) from public.share_claims where claimer_id = p_user_id),
      'reviews_total', (select count(*) from public.reviews where consumer_id = p_user_id),
      'recent_orders', (
        select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
          select o.id, o.status, o.delivery_type, o.total_amount, o.created_at, s.name as store_name
          from public.orders o join public.stores s on s.id = o.store_id
          where o.consumer_id = p_user_id
          order by o.created_at desc
          limit 10
        ) t
      )
    )
  );

  -- store owner
  if v_profile.role = 'store' then
    v_result := v_result || jsonb_build_object('store', (
      select jsonb_build_object(
        'id', s.id, 'name', s.name, 'address', s.address, 'phone', s.phone,
        'latitude', s.latitude, 'longitude', s.longitude, 'delivery_fee', s.delivery_fee,
        'logo_url', s.logo_url, 'verified', s.verified, 'created_at', s.created_at,
        'products_total', (select count(*) from public.products p where p.store_id = s.id),
        'products_active', (select count(*) from public.products p where p.store_id = s.id and p.status = 'active'),
        'orders_completed', (select count(*) from public.orders o where o.store_id = s.id and o.status = 'completed'),
        'gross', (select coalesce(sum(o.total_amount - o.delivery_fee), 0) from public.orders o where o.store_id = s.id and o.status = 'completed'),
        'commission', (select coalesce(sum(o.commission_amount), 0) from public.orders o where o.store_id = s.id and o.status = 'completed'),
        'shares_quantity', (select coalesce(sum(sh.quantity), 0) from public.shares sh where sh.store_id = s.id)
      )
      from public.stores s where s.owner_id = p_user_id
    ));
  end if;

  -- rider
  if v_profile.role = 'rider' then
    v_result := v_result || jsonb_build_object('rider', (
      select jsonb_build_object(
        'vehicle_type', r.vehicle_type, 'license_plate', r.license_plate,
        'status', r.status, 'verified', r.verified, 'created_at', r.created_at,
        'deliveries_completed', (select count(*) from public.orders o where o.rider_id = r.id and o.status = 'completed'),
        'earnings', (select coalesce(sum(o.delivery_fee), 0) from public.orders o where o.rider_id = r.id and o.status = 'completed'),
        'rating_avg', (select round(avg(rating), 1) from public.reviews rv where rv.rider_id = r.id),
        'rating_count', (select count(*) from public.reviews rv where rv.rider_id = r.id)
      )
      from public.riders r where r.id = p_user_id
    ));
  end if;

  return v_result;
end;
$$;

revoke all on function public.admin_get_user(uuid) from public, anon;
grant execute on function public.admin_get_user(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 2. admin_store_commission(p_store_id): one store's deducted orders
-- ---------------------------------------------------------------------
create or replace function public.admin_store_commission(p_store_id uuid)
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
  if not exists (select 1 from public.stores where id = p_store_id) then
    raise exception 'NOT_FOUND';
  end if;

  select jsonb_build_object(
    'store', (
      select jsonb_build_object('id', s.id, 'name', s.name, 'phone', s.phone, 'verified', s.verified,
                                'owner_id', s.owner_id, 'owner_name', p.full_name)
      from public.stores s join public.profiles p on p.id = s.owner_id
      where s.id = p_store_id
    ),
    'totals', (
      select jsonb_build_object(
        'orders', count(*),
        'gross', coalesce(sum(total_amount - delivery_fee), 0),
        'commission', coalesce(sum(commission_amount), 0),
        'net', coalesce(sum(total_amount - delivery_fee - commission_amount), 0)
      )
      from public.orders where store_id = p_store_id and status = 'completed'
    ),
    'monthly', (
      select coalesce(jsonb_agg(row_to_json(m) order by m.month desc), '[]'::jsonb) from (
        select to_char(date_trunc('month', created_at at time zone 'Asia/Bangkok'), 'YYYY-MM') as month,
               count(*) as orders,
               coalesce(sum(total_amount - delivery_fee), 0) as gross,
               coalesce(sum(commission_amount), 0) as commission
        from public.orders where store_id = p_store_id and status = 'completed'
        group by 1
      ) m
    ),
    'orders', (
      select coalesce(jsonb_agg(row_to_json(o) order by o.created_at desc), '[]'::jsonb) from (
        select id, created_at, delivery_type, total_amount, delivery_fee,
               total_amount - delivery_fee as subtotal, commission_rate, commission_amount,
               total_amount - delivery_fee - commission_amount as net
        from public.orders where store_id = p_store_id and status = 'completed'
        order by created_at desc
        limit 200
      ) o
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_store_commission(uuid) from public, anon;
grant execute on function public.admin_store_commission(uuid) to authenticated;


-- Verify -- last statement, so the SQL Editor shows it after Run.
select count(*) as new_functions
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('admin_get_user', 'admin_store_commission');
-- Expect 1 row: new_functions = 2.
