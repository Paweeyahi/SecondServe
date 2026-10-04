-- =====================================================================
-- Core tables: profiles, stores, riders (M1)
-- Run in Supabase Dashboard > SQL Editor. Safe to run more than once.
--
-- These three tables were originally created by hand in the Supabase
-- dashboard, so no migration file ever contained their CREATE TABLE. This
-- file reconstructs their FINAL shape (docs/database.md + every later
-- ALTER: migration-plan-schema.sql added suspended / verified /
-- delivery_fee, migration-claim-timeout-and-store-logo.sql added logo_url).
--
-- * Fresh project: run this FIRST, before fix-auth-signup.sql (its signup
--   trigger inserts into these tables). See README "ลำดับการรัน".
-- * Existing project: every statement is IF NOT EXISTS, so running it
--   changes nothing -- the SELECT at the end then lists the live columns so
--   you can check they match the definitions below.
--
-- RLS policies and column grants for these tables live in rls-policies.sql.
-- =====================================================================

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('consumer', 'store', 'rider', 'admin')),
  full_name  text not null check (char_length(trim(full_name)) > 0),
  phone      text not null check (char_length(trim(phone)) >= 9),
  suspended  boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.stores (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null unique references public.profiles(id) on delete restrict,
  name         text not null check (char_length(trim(name)) > 0),
  address      text not null check (char_length(trim(address)) > 0),
  latitude     numeric(10, 7) not null check (latitude between -90 and 90),
  longitude    numeric(10, 7) not null check (longitude between -180 and 180),
  phone        text not null,
  delivery_fee numeric(10, 2) not null default 0 check (delivery_fee >= 0),
  verified     boolean not null default false,
  logo_url     text,
  created_at   timestamptz not null default now()
);

create table if not exists public.riders (
  id            uuid primary key references public.profiles(id) on delete cascade,
  vehicle_type  text not null check (vehicle_type in ('motorcycle', 'bicycle', 'car')),
  license_plate text not null check (char_length(trim(license_plate)) > 0),
  status        text not null default 'offline' check (status in ('available', 'busy', 'offline')),
  verified      boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.stores   enable row level security;
alter table public.riders   enable row level security;

-- Verify -- last statement, so the SQL Editor shows it after Run.
-- On an existing project this is a read-only snapshot of the live columns.
select table_name, column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name in ('profiles', 'stores', 'riders')
 order by table_name, ordinal_position;
-- Expect 23 rows: profiles 6, stores 11, riders 6 -- names/types matching
-- the CREATE TABLE statements above. Any extra or missing column means the
-- live database has drifted from this file: tell Claude which one.
