-- =====================================================================
-- Migration M8: shares table, RLS, and the atomic share_product() RPC
-- Run in Supabase Dashboard > SQL Editor. Safe to run more than once.
-- =====================================================================

create table if not exists public.shares (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id)   on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity   integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_shares_store on public.shares (store_id, created_at desc);

alter table public.shares enable row level security;

-- Store owners see their own shares log. (An admin-wide policy for the M9
-- metrics page is added when M9 is built.)
drop policy if exists "shares_select_own" on public.shares;
create policy "shares_select_own" on public.shares
  for select using (
    store_id in (select id from public.stores where owner_id = auth.uid())
  );

-- Direct writes stay blocked; share_product() is the only mutation path.
--
-- Sharing diverts the product's *entire* remaining stock: status flips to
-- 'shared' (a single-valued column, so a product can't be part-sellable /
-- part-donated) and the shares log records however much was on hand at that
-- moment -- both writes happen in one transaction, so a failure leaves
-- neither the status change nor the log row behind.
create or replace function public.share_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qty   int;
  v_store uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select quantity, store_id into v_qty, v_store
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

  update public.products set status = 'shared' where id = p_product_id;

  insert into public.shares (store_id, product_id, quantity)
  values (v_store, p_product_id, v_qty);
end;
$$;

revoke all on function public.share_product(uuid) from public, anon;
grant execute on function public.share_product(uuid) to authenticated;

-- Verify -- this SELECT is the file's last statement, so the SQL Editor's
-- result panel shows it automatically after Run.
select 'policy: ' || policyname as check_item, cmd::text as detail
  from pg_policies where tablename = 'shares'
union all
select 'function: ' || proname, 'exists'
  from pg_proc where proname = 'share_product';
-- Expect 2 rows: 1 policy + 1 function.
