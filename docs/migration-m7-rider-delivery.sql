-- =====================================================================
-- Migration M7: rider shift toggle, atomic job claim, delivery handover
-- Run in Supabase Dashboard > SQL Editor. Safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tighten the Job Pool clause of orders_select_related (from M4) to
--    verified riders only -- unverified riders must not see the pool at all.
-- ---------------------------------------------------------------------
drop policy if exists "orders_select_related" on public.orders;
create policy "orders_select_related" on public.orders
  for select using (
    consumer_id = auth.uid()
    or store_id in (select id from public.stores where owner_id = auth.uid())
    or rider_id = auth.uid()
    or (
      status = 'ready' and delivery_type = 'delivery' and rider_id is null
      and exists (
        select 1 from public.riders r
        where r.id = auth.uid() and r.verified = true
      )
    )
  );

-- ---------------------------------------------------------------------
-- 2. Shift toggle: available <-> offline. Blocked while on an active job.
-- ---------------------------------------------------------------------
create or replace function public.set_rider_shift(p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_status not in ('available', 'offline') then
    raise exception 'BAD_STATUS';
  end if;

  update public.riders
     set status = p_status
   where id = auth.uid()
     and status <> 'busy';

  if not found then
    raise exception 'RIDER_BUSY_OR_NOT_FOUND';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Atomic claim: one guarded UPDATE decides the race, never read-then-write.
-- ---------------------------------------------------------------------
create or replace function public.claim_delivery_job(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1 from public.riders
    where id = auth.uid() and verified = true and status = 'available'
  ) then
    raise exception 'RIDER_NOT_AVAILABLE';
  end if;

  update public.orders
     set rider_id = auth.uid(),
         status   = 'rider_assigned'
   where id = p_order_id
     and rider_id is null
     and status = 'ready'
     and delivery_type = 'delivery';

  if not found then
    raise exception 'JOB_ALREADY_TAKEN';
  end if;

  update public.riders set status = 'busy' where id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Handover: rider_assigned -> picked_up -> delivering -> completed.
--    Each a guarded update scoped to the assigned rider.
-- ---------------------------------------------------------------------
create or replace function public.mark_picked_up(p_order_id uuid)
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
     set status = 'picked_up'
   where id = p_order_id
     and status = 'rider_assigned'
     and rider_id = auth.uid();

  if not found then
    raise exception 'STALE_OR_FORBIDDEN';
  end if;
end;
$$;

create or replace function public.mark_delivering(p_order_id uuid)
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
     set status = 'delivering'
   where id = p_order_id
     and status = 'picked_up'
     and rider_id = auth.uid();

  if not found then
    raise exception 'STALE_OR_FORBIDDEN';
  end if;
end;
$$;

create or replace function public.mark_delivered(p_order_id uuid)
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
     and status = 'delivering'
     and rider_id = auth.uid();

  if not found then
    raise exception 'STALE_OR_FORBIDDEN';
  end if;

  update public.riders set status = 'available' where id = auth.uid();
end;
$$;

revoke all on function public.set_rider_shift(text)      from public, anon;
revoke all on function public.claim_delivery_job(uuid)    from public, anon;
revoke all on function public.mark_picked_up(uuid)        from public, anon;
revoke all on function public.mark_delivering(uuid)       from public, anon;
revoke all on function public.mark_delivered(uuid)        from public, anon;
grant execute on function public.set_rider_shift(text)      to authenticated;
grant execute on function public.claim_delivery_job(uuid)    to authenticated;
grant execute on function public.mark_picked_up(uuid)        to authenticated;
grant execute on function public.mark_delivering(uuid)       to authenticated;
grant execute on function public.mark_delivered(uuid)        to authenticated;

-- Verify -- this SELECT is the file's last statement, so the SQL Editor's
-- result panel shows it automatically after Run.
select 'function: ' || proname as check_item, 'exists' as detail
  from pg_proc
 where proname in ('set_rider_shift', 'claim_delivery_job', 'mark_picked_up', 'mark_delivering', 'mark_delivered')
union all
select 'policy: ' || policyname, cmd::text
  from pg_policies where policyname = 'orders_select_related';
-- Expect 6 rows: 5 functions + 1 policy.
