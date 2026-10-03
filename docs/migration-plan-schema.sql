-- =====================================================================
-- Migration: schema deltas required by docs/implementation-plan.md
-- (Resolved Decisions D1–D5)
-- Run in Supabase Dashboard > SQL Editor.
-- Safe to run once; every column has a DEFAULT so existing rows are fine.
-- Run this BEFORE (or after) docs/fix-auth-signup.sql — order does not matter.
-- =====================================================================

-- D5: admin moderation flags -----------------------------------------
alter table public.profiles
  add column if not exists suspended boolean not null default false;

alter table public.stores
  add column if not exists verified boolean not null default false;

alter table public.riders
  add column if not exists verified boolean not null default false;

-- D4: flat per-store delivery fee -----------------------------------
alter table public.stores
  add column if not exists delivery_fee numeric(10, 2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'stores_delivery_fee_check'
  ) then
    alter table public.stores
      add constraint stores_delivery_fee_check check (delivery_fee >= 0);
  end if;
end $$;

-- D1/D2: order status vocabulary now includes 'rider_assigned' -------
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add  constraint orders_status_check check (
  status in (
    'pending', 'confirmed', 'ready', 'rider_assigned',
    'picked_up', 'delivering', 'completed', 'cancelled'
  )
);

-- ---------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------
-- select column_name, data_type, column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and (table_name, column_name) in (
--     ('profiles','suspended'), ('stores','verified'),
--     ('stores','delivery_fee'), ('riders','verified')
--   );
