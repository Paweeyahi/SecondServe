-- =====================================================================
-- Fix: users could edit privileged columns on their own row
-- Run in Supabase Dashboard > SQL Editor. Safe to run more than once.
--
-- profiles_update_own / stores_update_own / riders_update_own (and the
-- matching *_insert_own policies) check only *which row* -- never *which
-- columns*. Supabase grants UPDATE/INSERT on every column to the
-- `authenticated` role by default, so any logged-in user could call the
-- REST API directly and:
--   * set their own profiles.role = 'admin'        (full admin takeover)
--   * set their own profiles.suspended = false     (lift their own ban)
--   * set their own stores.verified = true         (skip store approval)
--   * set their own riders.verified = true / status (skip rider approval,
--     bypass set_rider_shift's busy check)
--
-- Fix: column-level privileges. Clients may only touch the plain profile
-- fields the app actually edits; every privileged flag stays writable only
-- through the SECURITY DEFINER functions (which run as the table owner and
-- are unaffected by these grants), and new rows only come from the
-- handle_new_user() signup trigger (also SECURITY DEFINER).
--
-- App write paths after this file (all still work):
--   profiles  UPDATE (full_name, phone)                     -- /account page
--   stores    UPDATE (name, address, phone, latitude,
--                     longitude, delivery_fee)              -- store settings
--   riders    no direct writes -- set_rider_shift() etc.
-- =====================================================================

revoke insert, update on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

revoke insert, update on public.stores from anon, authenticated;
grant update (name, address, phone, latitude, longitude, delivery_fee)
  on public.stores to authenticated;

revoke insert, update on public.riders from anon, authenticated;


-- Verify -- last statement, so the SQL Editor shows it after Run.
select t.tbl || '.' || c.col as column_name,
       has_column_privilege('authenticated', 'public.' || t.tbl, c.col, 'UPDATE') as authenticated_can_update
  from (values
          ('profiles', 'full_name'), ('profiles', 'phone'),
          ('profiles', 'role'),      ('profiles', 'suspended'),
          ('stores',   'name'),      ('stores',   'delivery_fee'),
          ('stores',   'verified'),  ('stores',   'owner_id'),
          ('riders',   'verified'),  ('riders',   'status')
       ) as c(tbl, col)
  join (values ('profiles'), ('stores'), ('riders')) as t(tbl) on t.tbl = c.tbl
 order by t.tbl, c.col;
-- Expect 10 rows. true ONLY for: profiles.full_name, profiles.phone,
-- stores.name, stores.delivery_fee. Every other row must be false.
