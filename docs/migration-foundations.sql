-- =====================================================================
-- Donate directly to a foundation (no foundation user accounts)
-- Run in Supabase Dashboard > SQL Editor. Safe to run more than once.
-- PREREQUISITE: docs/migration-share-claims.sql must have run first
-- (this file replaces the share_product() / community_share_stats()
-- versions defined there).
--
-- Foundations are records an admin maintains -- they never log in. When
-- sharing a product, a store can either open it to the whole community
-- (existing claim flow) or earmark the entire lot for one foundation:
--
--   * foundations             -- admin-managed list (name, contact, active)
--   * shares.foundation_id    -- set = earmarked; remaining is 0, so the
--                                public claim flow can never touch it
--   * shares.delivered_at     -- store confirms hand-over to the foundation
--   * admin_save_foundation() -- admin create/edit (the only write path)
--   * mark_foundation_delivered() -- donating store confirms hand-over
--   * share_product()         -- gains p_foundation_id
--   * community_share_stats() -- gains per-foundation delivered totals
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. foundations table
-- ---------------------------------------------------------------------
create table if not exists public.foundations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  description text check (description is null or char_length(description) <= 500),
  address     text check (address is null or char_length(address) <= 300),
  phone       text check (phone is null or char_length(phone) <= 20),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.foundations enable row level security;

-- Foundations are public organisations: everyone may read the list (the
-- feed shows "given to <foundation>" even after one is deactivated).
-- Pickers filter on active = true. No write policy -- admin_save_foundation()
-- is the only write path.
drop policy if exists "foundations_select_public" on public.foundations;
create policy "foundations_select_public" on public.foundations
  for select using (true);


-- ---------------------------------------------------------------------
-- 2. shares: foundation_id + delivered_at
-- ---------------------------------------------------------------------
alter table public.shares
  add column if not exists foundation_id uuid references public.foundations(id) on delete restrict;
alter table public.shares add column if not exists delivered_at timestamptz;

alter table public.shares drop constraint if exists shares_delivered_needs_foundation;
alter table public.shares add constraint shares_delivered_needs_foundation
  check (delivered_at is null or foundation_id is not null);

create index if not exists idx_shares_foundation on public.shares (foundation_id)
  where foundation_id is not null;


-- ---------------------------------------------------------------------
-- 3. admin_save_foundation(): create (p_id null) or update
-- ---------------------------------------------------------------------
create or replace function public.admin_save_foundation(
  p_id uuid,
  p_name text,
  p_description text,
  p_address text,
  p_phone text,
  p_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY';
  end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'NAME_REQUIRED';
  end if;

  if p_id is null then
    insert into public.foundations (name, description, address, phone, active)
    values (
      btrim(p_name),
      nullif(btrim(coalesce(p_description, '')), ''),
      nullif(btrim(coalesce(p_address, '')), ''),
      nullif(btrim(coalesce(p_phone, '')), ''),
      coalesce(p_active, true)
    )
    returning id into v_id;
  else
    update public.foundations
       set name        = btrim(p_name),
           description = nullif(btrim(coalesce(p_description, '')), ''),
           address     = nullif(btrim(coalesce(p_address, '')), ''),
           phone       = nullif(btrim(coalesce(p_phone, '')), ''),
           active      = coalesce(p_active, active)
     where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'NOT_FOUND';
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.admin_save_foundation(uuid, text, text, text, text, boolean) from public, anon;
grant execute on function public.admin_save_foundation(uuid, text, text, text, text, boolean) to authenticated;


-- ---------------------------------------------------------------------
-- 4. share_product(): + optional p_foundation_id
-- ---------------------------------------------------------------------
-- Replaces the 2-arg version from migration-share-claims.sql. With a
-- foundation, the whole lot is earmarked: remaining = 0 so claim_share()
-- rejects it (NOT_ENOUGH_LEFT) and the public "available" feed skips it.
drop function if exists public.share_product(uuid);
drop function if exists public.share_product(uuid, text);

create or replace function public.share_product(
  p_product_id uuid,
  p_pickup_note text default null,
  p_foundation_id uuid default null
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
  if p_foundation_id is not null and not exists (
    select 1 from public.foundations where id = p_foundation_id and active
  ) then
    raise exception 'FOUNDATION_UNAVAILABLE';
  end if;

  update public.products set status = 'shared' where id = p_product_id;

  insert into public.shares (store_id, product_id, quantity, remaining, pickup_note, foundation_id)
  values (
    v_store, p_product_id, v_qty,
    case when p_foundation_id is null then v_qty else 0 end,
    v_note, p_foundation_id
  );
end;
$$;

revoke all on function public.share_product(uuid, text, uuid) from public, anon;
grant execute on function public.share_product(uuid, text, uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 5. mark_foundation_delivered(): donating store confirms hand-over
-- ---------------------------------------------------------------------
create or replace function public.mark_foundation_delivered(p_share_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.shares
     set delivered_at = now()
   where id = p_share_id
     and foundation_id is not null
     and delivered_at is null
     and store_id in (select id from public.stores where owner_id = auth.uid());

  if not found then
    raise exception 'NOT_FOUND_OR_ALREADY_DELIVERED';
  end if;
end;
$$;

revoke all on function public.mark_foundation_delivered(uuid) from public, anon;
grant execute on function public.mark_foundation_delivered(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 6. community_share_stats(): + foundation totals
-- ---------------------------------------------------------------------
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
    'foundation_delivered_quantity',
                          (select coalesce(sum(quantity), 0)
                             from public.shares where delivered_at is not null),
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
    ), '[]'::json),
    'foundations', coalesce((
      select json_agg(json_build_object(
               'id', f.id, 'name', f.name, 'description', f.description,
               'delivered_quantity', coalesce(d.qty, 0))
             order by coalesce(d.qty, 0) desc, f.name)
        from public.foundations f
        left join (
          select foundation_id, sum(quantity) as qty
            from public.shares
           where delivered_at is not null
           group by foundation_id
        ) d on d.foundation_id = f.id
       where f.active
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
   and column_name in ('foundation_id', 'delivered_at')
union all
select 'table', table_name
  from information_schema.tables
 where table_schema = 'public' and table_name = 'foundations'
union all
select 'policy', policyname
  from pg_policies
 where schemaname = 'public' and policyname = 'foundations_select_public'
union all
select 'function', proname || '(' || pronargs || ' args)'
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('admin_save_foundation', 'share_product',
                   'mark_foundation_delivered', 'community_share_stats')
order by kind, name;
-- Expect 8 rows: 2 columns, 1 table, 1 policy, 4 functions
-- (share_product must show "3 args" exactly once).
