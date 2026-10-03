-- =====================================================================
-- Migration M6: store order fulfillment transitions
-- Run in Supabase Dashboard > SQL Editor. Safe to run more than once.
--
-- Each transition is one guarded UPDATE (id + expected status + store
-- ownership); 0 rows affected raises STALE_OR_FORBIDDEN so the caller can
-- tell "someone else already moved this order" apart from "not yours".
-- Direct client writes to orders stay unavailable (see migration-m4-orders.sql);
-- these SECURITY DEFINER functions are the only way to mutate order status.
-- =====================================================================

create or replace function public.confirm_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.orders
     set status = 'confirmed'
   where id = p_order_id
     and status = 'pending'
     and store_id in (select id from public.stores where owner_id = auth.uid());

  if not found then
    raise exception 'STALE_OR_FORBIDDEN';
  end if;
end;
$$;

create or replace function public.mark_order_ready(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.orders
     set status = 'ready'
   where id = p_order_id
     and status = 'confirmed'
     and store_id in (select id from public.stores where owner_id = auth.uid());

  if not found then
    raise exception 'STALE_OR_FORBIDDEN';
  end if;
end;
$$;

-- Pickup only: the store hands the order directly to the consumer.
-- A `delivery` order at `ready` moves on via the rider workflow (M7) instead.
create or replace function public.complete_pickup_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.orders
     set status = 'completed'
   where id = p_order_id
     and status = 'ready'
     and delivery_type = 'pickup'
     and store_id in (select id from public.stores where owner_id = auth.uid());

  if not found then
    raise exception 'STALE_OR_FORBIDDEN';
  end if;
end;
$$;

-- Cancellable from pending/confirmed/ready; restocks every line item and
-- flips any now-in-stock product back to active, atomically with the status
-- change (D3).
create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.orders
     set status = 'cancelled'
   where id = p_order_id
     and status in ('pending', 'confirmed', 'ready')
     and store_id in (select id from public.stores where owner_id = auth.uid());

  if not found then
    raise exception 'STALE_OR_FORBIDDEN';
  end if;

  for v_item in
    select product_id, quantity from public.order_items where order_id = p_order_id
  loop
    update public.products
       set quantity = quantity + v_item.quantity,
           status   = case when status = 'sold_out' then 'active' else status end
     where id = v_item.product_id;
  end loop;
end;
$$;

revoke all on function public.confirm_order(uuid)        from public, anon;
revoke all on function public.mark_order_ready(uuid)      from public, anon;
revoke all on function public.complete_pickup_order(uuid) from public, anon;
revoke all on function public.cancel_order(uuid)          from public, anon;
grant execute on function public.confirm_order(uuid)        to authenticated;
grant execute on function public.mark_order_ready(uuid)      to authenticated;
grant execute on function public.complete_pickup_order(uuid) to authenticated;
grant execute on function public.cancel_order(uuid)          to authenticated;

-- Verify -- this SELECT is the file's last statement, so the SQL Editor's
-- result panel shows it automatically after Run.
select 'function: ' || proname as check_item, 'exists' as detail
  from pg_proc
 where proname in ('confirm_order', 'mark_order_ready', 'complete_pickup_order', 'cancel_order');
-- Expect 4 rows.
