-- =====================================================================
-- Migration M11: store reviews & ratings
-- Run in Supabase Dashboard > SQL Editor. Safe to run more than once.
--
-- Post-MVP addition (scope.md "Added post-MVP", 2026-09-18). A consumer may
-- rate + comment on a store once their order reaches 'completed' -- one
-- review per order. Public SELECT (like the product catalog); the
-- submit_review() SECURITY DEFINER RPC is the only write path, matching
-- every other mutation in this app (place_order, confirm_order, etc.).
-- =====================================================================

create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null unique references public.orders(id) on delete cascade,
  consumer_id uuid not null references public.profiles(id) on delete cascade,
  store_id    uuid not null references public.stores(id) on delete cascade,
  rating      int not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_reviews_store on public.reviews (store_id, created_at desc);

alter table public.reviews enable row level security;

-- Public read, same spirit as the product catalog and the shares feed --
-- anyone deciding whether to buy from a store should see its reviews.
drop policy if exists "reviews_select_public" on public.reviews;
create policy "reviews_select_public" on public.reviews
  for select using (true);

-- Direct writes stay blocked; submit_review() is the only mutation path.
create or replace function public.submit_review(
  p_order_id uuid,
  p_rating   int,
  p_comment  text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consumer uuid := auth.uid();
  v_order    public.orders%rowtype;
  v_review_id uuid;
begin
  if v_consumer is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_rating < 1 or p_rating > 5 then
    raise exception 'BAD_RATING';
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

  if exists (select 1 from public.reviews where order_id = p_order_id) then
    raise exception 'ALREADY_REVIEWED';
  end if;

  insert into public.reviews (order_id, consumer_id, store_id, rating, comment)
  values (p_order_id, v_consumer, v_order.store_id, p_rating, nullif(trim(coalesce(p_comment, '')), ''))
  returning id into v_review_id;

  return v_review_id;
end;
$$;

revoke all on function public.submit_review(uuid, int, text) from public, anon;
grant execute on function public.submit_review(uuid, int, text) to authenticated;

-- Verify -- this SELECT is the file's last statement, so the SQL Editor's
-- result panel shows it automatically after Run.
select 'policy: ' || policyname as check_item, cmd::text as detail
  from pg_policies where tablename = 'reviews'
union all
select 'function: ' || proname, 'exists'
  from pg_proc where proname = 'submit_review';
-- Expect 2 rows.
