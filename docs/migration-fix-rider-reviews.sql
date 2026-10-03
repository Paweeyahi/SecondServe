-- =====================================================================
-- Fix: extend reviews to also cover riders (not just stores)
-- Run in Supabase Dashboard > SQL Editor. Safe to run more than once.
-- Run AFTER migration-m11-reviews.sql.
--
-- M11 modeled `reviews` as store-only: one review per order, `store_id`
-- required. A consumer picking a delivery order wants to rate the delivery
-- experience separately from the food/store experience, so this makes
-- `store_id` nullable, adds `rider_id`, and enforces "exactly one target per
-- row" via a CHECK. Since one order can now carry up to two reviews (one
-- per target), the old `UNIQUE(order_id)` is replaced by two partial unique
-- indexes -- at most one store review and at most one rider review per
-- order. `submit_review()` is dropped and recreated with a `p_target`
-- parameter ('store' | 'rider').
-- =====================================================================

alter table public.reviews add column if not exists rider_id uuid references public.profiles(id) on delete cascade;
alter table public.reviews alter column store_id drop not null;

alter table public.reviews drop constraint if exists reviews_order_id_key;

alter table public.reviews drop constraint if exists reviews_target_check;
alter table public.reviews add constraint reviews_target_check check (
  (store_id is not null and rider_id is null)
  or (store_id is null and rider_id is not null)
);

create unique index if not exists reviews_order_store_uniq
  on public.reviews (order_id) where store_id is not null;
create unique index if not exists reviews_order_rider_uniq
  on public.reviews (order_id) where rider_id is not null;

create index if not exists idx_reviews_rider on public.reviews (rider_id, created_at desc);

drop function if exists public.submit_review(uuid, int, text);

create or replace function public.submit_review(
  p_order_id uuid,
  p_target   text,   -- 'store' | 'rider'
  p_rating   int,
  p_comment  text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consumer  uuid := auth.uid();
  v_order     public.orders%rowtype;
  v_review_id uuid;
  v_comment   text := nullif(trim(coalesce(p_comment, '')), '');
begin
  if v_consumer is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_rating < 1 or p_rating > 5 then
    raise exception 'BAD_RATING';
  end if;
  if p_target not in ('store', 'rider') then
    raise exception 'BAD_TARGET';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.consumer_id <> v_consumer then
    raise exception 'NOT_YOUR_ORDER';
  end if;
  if v_order.status <> 'completed' then
    raise exception 'ORDER_NOT_COMPLETED';
  end if;

  if p_target = 'store' then
    if exists (select 1 from public.reviews where order_id = p_order_id and store_id is not null) then
      raise exception 'ALREADY_REVIEWED';
    end if;
    insert into public.reviews (order_id, consumer_id, store_id, rating, comment)
    values (p_order_id, v_consumer, v_order.store_id, p_rating, v_comment)
    returning id into v_review_id;
  else
    if v_order.rider_id is null then
      raise exception 'NO_RIDER_ON_ORDER';
    end if;
    if exists (select 1 from public.reviews where order_id = p_order_id and rider_id is not null) then
      raise exception 'ALREADY_REVIEWED';
    end if;
    insert into public.reviews (order_id, consumer_id, rider_id, rating, comment)
    values (p_order_id, v_consumer, v_order.rider_id, p_rating, v_comment)
    returning id into v_review_id;
  end if;

  return v_review_id;
end;
$$;

revoke all on function public.submit_review(uuid, text, int, text) from public, anon;
grant execute on function public.submit_review(uuid, text, int, text) to authenticated;

-- Verify -- this SELECT is the file's last statement, so the SQL Editor's
-- result panel shows it automatically after Run.
select 'column: rider_id' as check_item,
       (exists (select 1 from information_schema.columns
                where table_name = 'reviews' and column_name = 'rider_id'))::text as detail
union all
select 'function: submit_review(uuid,text,int,text)', 'exists'
  from pg_proc where proname = 'submit_review';
-- Expect 2 rows, both "true"/"exists".
