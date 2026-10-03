-- =====================================================================
-- FIX: "Database error saving new user" ตอนสมัครสมาชิก (โดยเฉพาะ role = store)
-- รันสคริปต์นี้ใน Supabase Dashboard > SQL Editor
-- =====================================================================

-- ---------------------------------------------------------------------
-- STEP 0 (วินิจฉัย): ดูว่ามี trigger อะไรอยู่บน auth.users บ้าง
-- ---------------------------------------------------------------------
-- select t.tgname, p.proname
-- from pg_trigger t
-- join pg_proc p on p.oid = t.tgfoid
-- where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal;
--
-- select prosrc from pg_proc where proname = 'handle_new_user';
--
-- สาเหตุที่พบบ่อย: trigger handle_new_user() insert ลง public.profiles แล้ว
-- ชนกับ CHECK/NOT NULL ของคอลัมน์ phone หรือ full_name เพราะตอน signUp
-- โค้ดส่ง metadata มาแค่ full_name กับ role (ไม่ได้ส่ง phone) => ทั้ง transaction
-- ของ auth ถูก rollback => GoTrue คืน error "Database error saving new user"

-- ---------------------------------------------------------------------
-- STEP 1: สร้าง trigger function ให้ทนทาน (ไม่บล็อกการสมัคร)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role  text := coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'consumer');
  v_name  text := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'ผู้ใช้ใหม่');
  v_phone text := coalesce(nullif(trim(new.raw_user_meta_data->>'phone'), ''), '000000000');
begin
  -- profiles (ทุก role)
  insert into public.profiles (id, role, full_name, phone)
  values (new.id, v_role, v_name, v_phone)
  on conflict (id) do nothing;

  -- stores (เฉพาะ role = store)
  if v_role = 'store' then
    insert into public.stores (owner_id, name, address, latitude, longitude, phone)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data->>'store_name'), ''), v_name),
      coalesce(nullif(trim(new.raw_user_meta_data->>'store_address'), ''), 'ยังไม่ได้ระบุที่อยู่ร้านค้า'),
      13.7563,
      100.5018,
      v_phone
    )
    on conflict (owner_id) do nothing;
  end if;

  -- riders (เฉพาะ role = rider)
  if v_role = 'rider' then
    insert into public.riders (id, vehicle_type, license_plate, status)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data->>'vehicle_type', ''), 'motorcycle'),
      coalesce(nullif(trim(new.raw_user_meta_data->>'license_plate'), ''), 'รอลงทะเบียน'),
      'offline'
    )
    on conflict (id) do nothing;
  end if;

  return new;
exception
  when others then
    -- ไม่ว่าเกิดอะไรขึ้นก็ห้ามบล็อกการสร้าง auth user
    raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
    return new;
end;
$$;

-- ---------------------------------------------------------------------
-- STEP 2: ผูก trigger กับ auth.users (สร้างใหม่ให้ชัวร์)
-- ---------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- STEP 3: เปิด RLS + policy ให้ผู้ใช้จัดการข้อมูลของตัวเองได้
--   trigger ด้านบนสร้าง row ให้แล้ว (SECURITY DEFINER ข้าม RLS)
--   policy ชุดนี้ไว้สำหรับ "อ่าน/แก้ไข" ข้อมูลตัวเองหลังจากล็อกอิน
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.stores   enable row level security;
alter table public.riders   enable row level security;

-- profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- stores
drop policy if exists "stores_select_all" on public.stores;
create policy "stores_select_all" on public.stores
  for select using (true);

drop policy if exists "stores_insert_own" on public.stores;
create policy "stores_insert_own" on public.stores
  for insert with check (auth.uid() = owner_id);

drop policy if exists "stores_update_own" on public.stores;
create policy "stores_update_own" on public.stores
  for update using (auth.uid() = owner_id);

-- riders
drop policy if exists "riders_select_own" on public.riders;
create policy "riders_select_own" on public.riders
  for select using (auth.uid() = id);

drop policy if exists "riders_insert_own" on public.riders;
create policy "riders_insert_own" on public.riders
  for insert with check (auth.uid() = id);

drop policy if exists "riders_update_own" on public.riders;
create policy "riders_update_own" on public.riders
  for update using (auth.uid() = id);

-- ---------------------------------------------------------------------
-- STEP 4 (dev): ปิด email confirmation เพื่อให้ signUp คืน session ทันที
--   Dashboard > Authentication > Providers > Email > ปิด "Confirm email"
--   ไม่งั้นหลัง signUp จะไม่มี session และการ insert stores/profiles ฝั่งแอปจะโดน RLS บล็อก
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- STEP 5 (ถ้ามี auth user ค้างจากการทดสอบที่ล้มเหลว ให้ลบทิ้งก่อนสมัครใหม่)
--   Dashboard > Authentication > Users > ลบ user ที่ทดสอบไว้
-- ---------------------------------------------------------------------

-- =====================================================================
-- STEP 6 (วินิจฉัย): "ทำไมไม่มีข้อมูลใน stores"
-- =====================================================================

-- 6.1 metadata ที่แอปส่งมาจริง — ต้องเห็น key: role, store_name, store_address
select id, email, email_confirmed_at, created_at, raw_user_meta_data
from auth.users
order by created_at desc
limit 5;

-- 6.2 profile ถูกสร้างไหม / role เป็นอะไร
select p.id, p.role, p.full_name, p.phone, p.created_at
from public.profiles p
order by p.created_at desc
limit 5;

-- 6.3 มี store ไหม
select * from public.stores order by created_at desc limit 5;

-- 6.4 ดู warning ที่ trigger คายออกมา:
--     Dashboard > Logs > Postgres Logs  แล้วค้นคำว่า  handle_new_user

-- 6.5 ถ้ายังหาสาเหตุไม่เจอ ให้ลง "เวอร์ชันเสียงดัง" ชั่วคราว (ลบ EXCEPTION ออก)
--     เพื่อให้ error ที่แท้จริงเด้งขึ้นมาตอนสมัคร แล้วค่อยเปลี่ยนกลับเป็นเวอร์ชันบน
/*
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role  text := coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'consumer');
  v_name  text := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'ผู้ใช้ใหม่');
  v_phone text := coalesce(nullif(trim(new.raw_user_meta_data->>'phone'), ''), '000000000');
begin
  insert into public.profiles (id, role, full_name, phone)
  values (new.id, v_role, v_name, v_phone)
  on conflict (id) do nothing;

  if v_role = 'store' then
    insert into public.stores (owner_id, name, address, latitude, longitude, phone)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data->>'store_name'), ''), v_name),
      coalesce(nullif(trim(new.raw_user_meta_data->>'store_address'), ''), 'ยังไม่ได้ระบุที่อยู่ร้านค้า'),
      13.7563, 100.5018, v_phone
    )
    on conflict (owner_id) do nothing;
  end if;

  if v_role = 'rider' then
    insert into public.riders (id, vehicle_type, license_plate, status)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data->>'vehicle_type', ''), 'motorcycle'),
      coalesce(nullif(trim(new.raw_user_meta_data->>'license_plate'), ''), 'รอลงทะเบียน'),
      'offline'
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;
*/

-- 6.6 เติม store ให้ user ที่สมัครไปแล้วแต่ตกหล่น (รันครั้งเดียว)
insert into public.stores (owner_id, name, address, latitude, longitude, phone)
select p.id,
       coalesce(nullif(trim(u.raw_user_meta_data->>'store_name'), ''), p.full_name),
       coalesce(nullif(trim(u.raw_user_meta_data->>'store_address'), ''), 'ยังไม่ได้ระบุที่อยู่ร้านค้า'),
       13.7563, 100.5018, p.phone
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'store'
  and not exists (select 1 from public.stores s where s.owner_id = p.id);
