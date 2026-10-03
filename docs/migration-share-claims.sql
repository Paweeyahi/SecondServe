-- =====================================================================
-- Community donations become claimable (M8 extension)
-- Run in Supabase Dashboard > SQL Editor. Safe to run more than once.
--
-- Before this file, a share was only a log row -- "store X gave away N
-- pieces of Y" -- with no way for anyone to actually receive the food.
-- This adds the receiving side:
--
--   * shares.remaining      -- pieces still unclaimed (starts = quantity)
--   * shares.pickup_note    -- optional pickup instructions from the store
--   * share_claims          -- one row per consumer request to receive
--                              (reserved -> collected | cancelled)
--   * claim_share()         -- consumer reserves 1-5 pieces (row-locked)
--   * cancel_share_claim()  -- claimer or store cancels; stock returns
--   * mark_share_collected()-- store confirms the claimer picked it up
--   * community_share_stats() -- public aggregate numbers for /shares
--   * share_product()       -- gains p_pickup_note, refuses expired stock
--
-- Also fixes a latent visibility gap: products_select_public only exposes
-- status = 'active', so the shared product's name/image on /shares came
-- back null for logged-out visitors. products_select_shared covers that.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. shares: remaining + pickup_note
-- ---------------------------------------------------------------------
alter table public.shares add column if not exists remaining integer;
alter table public.shares add column if not exists pickup_note text;

update public.shares set remaining = quantity where remaining is null;

alter table public.shares alter column remaining set not null;

alter table public.shares drop constraint if exists shares_remaining_range;
alter table public.shares add constraint shares_remaining_range
  check (remaining >= 0 and remaining <= quantity);

alter table public.shares drop constraint if exists shares_pickup_note_length;
alter table public.shares add constraint shares_pickup_note_length
  check (pickup_note is null or char_length(pickup_note) <= 200);


-- ---------------------------------------------------------------------
-- 2. share_claims table
-- ---------------------------------------------------------------------
create table if not exists public.share_claims (
  id          uuid primary key default gen_random_uuid(),
  share_id    uuid not null references public.shares(id)   on delete cascade,
  claimer_id  uuid not null references public.profiles(id) on delete cascade,
  quantity    integer not null check (quantity > 0),
  status      text not null default 'reserved'
              check (status in ('reserved', 'collected', 'cancelled')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_share_claims_share   on public.share_claims (share_id);
create index if not exists idx_share_claims_claimer on public.share_claims (claimer_id, created_at desc);

-- One live (non-cancelled) claim per person per share, so one person can't
-- drain a donation with repeated requests. Cancelling frees the slot.
create unique index if not exists uq_share_claims_one_per_person
  on public.share_claims (share_id, claimer_id)
  where status <> 'cancelled';

alter table public.share_claims enable row level security;

-- Claimer sees their own, the donating store sees claims on its shares,
-- admin sees everything. No insert/update/delete policy -- the three
-- SECURITY DEFINER functions below are the only write path.
drop policy if exists "share_claims_select_related" on public.share_claims;
create policy "share_claims_select_related" on public.share_claims
  for select using (
    claimer_id = auth.uid()
    or exists (
      select 1 from public.shares s
      where s.id = share_claims.share_id
        and s.store_id in (select id from public.stores where owner_id = auth.uid())
    )
    or public.is_admin()
  );


-- ---------------------------------------------------------------------
-- 3. Visibility fixes
-- ---------------------------------------------------------------------
-- Shared products are public by nature (they're on the public feed).
drop policy if exists "products_select_shared" on public.products;
create policy "products_select_shared" on public.products
  for select using (status = 'shared');

-- The donating store needs the claimer's name/phone to hand food over.
drop policy if exists "profiles_select_share_claimer" on public.profiles;
create policy "profiles_select_share_claimer" on public.profiles
  for select using (
    exists (
      select 1
      from public.share_claims c
      join public.shares s on s.id = c.share_id
      where c.claimer_id = profiles.id
        and s.store_id in (select id from public.stores where owner_id = auth.uid())
    )
  );


-- ---------------------------------------------------------------------
-- 4. share_product(): + pickup note, refuse expired stock
-- ---------------------------------------------------------------------
drop function if exists public.share_product(uuid);

create or replace function public.share_product(
  p_product_id uuid,
  p_pickup_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qty    int;
  v_store  uuid;
  v_expiry timestamptz;
  v_note   text := nullif(btrim(coalesce(p_pickup_note, '')), '');
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select quantity, store_id, expiry_date into v_qty, v_store, v_expiry
    from public.products
   where id = p_product_id
     and status = 'active'
     and store_id in (select id from public.stores where owner_id = auth.uid())
   for update;

  if not found then
    raise exception 'NOT_FOUND_OR_FORBIDDEN';
  end if;
  if v_qty <= 0 then
    raise exception 'NOTHING_TO_SHARE';
  end if;
  if v_expiry <= now() then
    raise exception 'PRODUCT_EXPIRED';
  end if;
  if v_note is not null and char_length(v_note) > 200 then
    raise exception 'NOTE_TOO_LONG';
  end if;

  update public.products set status = 'shared' where id = p_product_id;

  insert into public.shares (store_id, product_id, quantity, remaining, pickup_note)
  values (v_store, p_product_id, v_qty, v_qty, v_note);
end;
$$;

revoke all on function public.share_product(uuid, text) from public, anon;
grant execute on function public.share_product(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- 5. claim_share(): consumer reserves 1-5 pieces
-- ---------------------------------------------------------------------
create or replace function public.claim_share(p_share_id uuid, p_quantity int)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining int;
  v_expiry    timestamptz;
  v_verified  boolean;
  v_claim_id  uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'consumer' and suspended = false
  ) then
    raise exception 'CONSUMER_ONLY';
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 5 then
    raise exception 'BAD_QUANTITY';
  end if;

  -- Lock the share row: concurrent claims on the same donation serialize
  -- here, so `remaining` can never be over-allocated.
  select s.remaining, p.expiry_date, st.verified
    into v_remaining, v_expiry, v_verified
    from public.shares s
    join public.products p on p.id = s.product_id
    join public.stores  st on st.id = s.store_id
   where s.id = p_share_id
   for update of s;

  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_expiry <= now() then
    raise exception 'SHARE_EXPIRED';
  end if;
  if not v_verified then
    raise exception 'STORE_UNAVAILABLE';
  end if;
  if exists (
    select 1 from public.share_claims
    where share_id = p_share_id and claimer_id = auth.uid() and status <> 'cancelled'
  ) then
    raise exception 'ALREADY_CLAIMED';
  end if;
  if v_remaining < p_quantity then
    raise exception 'NOT_ENOUGH_LEFT';
  end if;

  update public.shares set remaining = remaining - p_quantity where id = p_share_id;

  insert into public.share_claims (share_id, claimer_id, quantity)
  values (p_share_id, auth.uid(), p_quantity)
  returning id into v_claim_id;

  return v_claim_id;
end;
$$;

revoke all on function public.claim_share(uuid, int) from public, anon;
grant execute on function public.claim_share(uuid, int) to authenticated;


-- ---------------------------------------------------------------------
-- 6. cancel_share_claim(): claimer or donating store; stock returns
-- ---------------------------------------------------------------------
create or replace function public.cancel_share_claim(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share_id uuid;
  v_claimer  uuid;
  v_qty      int;
  v_status   text;
  v_store    uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select share_id into v_share_id from public.share_claims where id = p_claim_id;
  if not found then
    raise exception 'NOT_FOUND_OR_FORBIDDEN';
  end if;

  -- Lock order: share, then claim (claim_share locks the share first too).
  select store_id into v_store from public.shares where id = v_share_id for update;

  select claimer_id, quantity, status into v_claimer, v_qty, v_status
    from public.share_claims where id = p_claim_id for update;

  if v_claimer <> auth.uid()
     and v_store not in (select id from public.stores where owner_id = auth.uid()) then
    raise exception 'NOT_FOUND_OR_FORBIDDEN';
  end if;
  if v_status <> 'reserved' then
    raise exception 'NOT_RESERVED';
  end if;

  update public.share_claims
     set status = 'cancelled', resolved_at = now()
   where id = p_claim_id;

  update public.shares set remaining = remaining + v_qty where id = v_share_id;
end;
$$;

revoke all on function public.cancel_share_claim(uuid) from public, anon;
grant execute on function public.cancel_share_claim(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 7. mark_share_collected(): donating store confirms hand-over
-- ---------------------------------------------------------------------
create or replace function public.mark_share_collected(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.share_claims c
     set status = 'collected', resolved_at = now()
    from public.shares s
   where c.id = p_claim_id
     and s.id = c.share_id
     and s.store_id in (select id from public.stores where owner_id = auth.uid())
     and c.status = 'reserved';

  if not found then
    raise exception 'NOT_FOUND_OR_NOT_RESERVED';
  end if;
end;
$$;

revoke all on function public.mark_share_collected(uuid) from public, anon;
grant execute on function public.mark_share_collected(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 8. community_share_stats(): public aggregates for /shares
-- ---------------------------------------------------------------------
-- SECURITY DEFINER because collected totals come from share_claims, which
-- is not publicly readable row-by-row -- only these sums are exposed.
create or replace function public.community_share_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'total_quantity',     (select coalesce(sum(quantity), 0) from public.shares),
    'store_count',        (select count(distinct store_id) from public.shares),
    'collected_quantity', (select coalesce(sum(quantity), 0)
                             from public.share_claims where status = 'collected'),
    'available_quantity', (select coalesce(sum(s.remaining), 0)
                             from public.shares s
                             join public.products p on p.id = s.product_id
                             join public.stores  st on st.id = s.store_id
                            where p.expiry_date > now() and st.verified),
    'by_category', coalesce((
      select json_agg(json_build_object('category', category, 'quantity', qty)
                      order by qty desc)
        from (
          select p.category, sum(s.quantity) as qty
            from public.shares s
            join public.products p on p.id = s.product_id
           group by p.category
        ) t
    ), '[]'::json)
  );
$$;

revoke all on function public.community_share_stats() from public;
grant execute on function public.community_share_stats() to anon, authenticated;


-- ---------------------------------------------------------------------
-- Verify -- last statement, so the SQL Editor shows it after Run.
-- ---------------------------------------------------------------------
select 'column' as kind, 'shares.' || column_name as name
  from information_schema.columns
 where table_schema = 'public' and table_name = 'shares'
   and column_name in ('remaining', 'pickup_note')
union all
select 'table', table_name
  from information_schema.tables
 where table_schema = 'public' and table_name = 'share_claims'
union all
select 'policy', policyname
  from pg_policies
 where schemaname = 'public'
   and policyname in ('share_claims_select_related', 'products_select_shared',
                      'profiles_select_share_claimer')
union all
select 'function', proname || '(' || pronargs || ' args)'
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('share_product', 'claim_share', 'cancel_share_claim',
                   'mark_share_collected', 'community_share_stats')
order by kind, name;
-- Expect 11 rows: 2 columns, 1 table, 3 policies, 5 functions
-- (share_product must show "2 args" exactly once -- the old 1-arg one is dropped).
