-- =====================================================================
-- Migration M12: web push subscriptions + targeted lookup RPCs
-- Run in Supabase Dashboard > SQL Editor. Safe to run more than once.
--
-- Post-MVP addition (scope.md "Added post-MVP", 2026-09-18). Self-hosted via
-- the browser's native Push API + VAPID (no third-party push account) --
-- see .env.local for the key pair and src/lib/push/send.ts for the actual
-- send call (Postgres cannot make the HTTPS push request itself).
-- =====================================================================

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth_key   text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- A user manages only their own subscriptions directly (no RPC needed --
-- same self-scoped-write pattern as riders_update_own from M1).
drop policy if exists "push_subscriptions_own" on public.push_subscriptions;
create policy "push_subscriptions_own" on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Sending needs to read the *other* party's subscriptions (e.g. a store
-- confirming an order needs the consumer's endpoint), which the policy
-- above deliberately does not allow. These SECURITY DEFINER functions are
-- narrow, purpose-built lookups instead of a generic "any user's
-- subscriptions" RPC: each one re-derives the legitimate recipient from an
-- order/job the caller is already related to (mirroring
-- orders_select_related's own relatedness checks), so a caller can only
-- ever reach the subscriptions of someone their own action is about to
-- notify -- never an arbitrary user_id.
-- ---------------------------------------------------------------------
create or replace function public.get_order_push_targets(p_order_id uuid, p_target text)
returns table (endpoint text, p256dh text, auth_key text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order  public.orders%rowtype;
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if not (
    v_order.consumer_id = v_caller
    or v_order.rider_id = v_caller
    or v_order.store_id in (select id from public.stores where owner_id = v_caller)
  ) then
    raise exception 'FORBIDDEN';
  end if;

  if p_target = 'consumer' then
    return query
      select ps.endpoint, ps.p256dh, ps.auth_key
        from public.push_subscriptions ps
       where ps.user_id = v_order.consumer_id;
  elsif p_target = 'store' then
    return query
      select ps.endpoint, ps.p256dh, ps.auth_key
        from public.push_subscriptions ps
        join public.stores s on s.owner_id = ps.user_id
       where s.id = v_order.store_id;
  elsif p_target = 'rider' then
    if v_order.rider_id is null then
      return;
    end if;
    return query
      select ps.endpoint, ps.p256dh, ps.auth_key
        from public.push_subscriptions ps
       where ps.user_id = v_order.rider_id;
  else
    raise exception 'BAD_TARGET';
  end if;
end;
$$;

-- Broadcast target for "a new job appeared in the pool" -- every verified,
-- on-shift rider. Any authenticated user may call this (it only ever
-- reveals on-shift riders' own push endpoints, the intended recipients of
-- exactly this notification), matching the Job Pool's own visibility rule
-- from orders_select_related (M7).
create or replace function public.get_available_rider_push_targets()
returns table (endpoint text, p256dh text, auth_key text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  return query
    select ps.endpoint, ps.p256dh, ps.auth_key
      from public.push_subscriptions ps
      join public.riders r on r.id = ps.user_id
     where r.status = 'available' and r.verified = true;
end;
$$;

revoke all on function public.get_order_push_targets(uuid, text) from public, anon;
revoke all on function public.get_available_rider_push_targets() from public, anon;
grant execute on function public.get_order_push_targets(uuid, text) to authenticated;
grant execute on function public.get_available_rider_push_targets() to authenticated;

-- Verify -- this SELECT is the file's last statement, so the SQL Editor's
-- result panel shows it automatically after Run.
select 'policy: ' || policyname as check_item, cmd::text as detail
  from pg_policies where tablename = 'push_subscriptions'
union all
select 'function: ' || proname, 'exists'
  from pg_proc where proname in ('get_order_push_targets', 'get_available_rider_push_targets');
-- Expect 3 rows: 1 policy + 2 functions.
