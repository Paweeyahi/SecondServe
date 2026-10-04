# SecondServe — More Than an Expiry Date

แพลตฟอร์มส่งต่อสินค้าใกล้หมดอายุ เชื่อม **ผู้บริโภค ร้านค้า ไรเดอร์ และแอดมิน** เข้าด้วยกัน
ซื้อของดีราคาประหยัด รับเองหรือให้ไรเดอร์ส่ง และส่งต่ออาหารให้ชุมชน/มูลนิธิแทนการทิ้ง

**Stack:** Next.js 14 (App Router, Server Actions) · TypeScript · Tailwind CSS · Supabase
(Postgres + Auth + Storage + Realtime + pg_cron) · Zod · Vercel

---

## ฟีเจอร์หลัก

| บทบาท | ทำอะไรได้ |
|---|---|
| ผู้บริโภค | ค้นหา/กรองสินค้า (10 หมวด, แบ่งหน้า, เรียงตามระยะทาง "ร้านใกล้ฉัน"), หน้ารายละเอียดสินค้า, ตะกร้า + สั่งซื้อ (รับเอง/จัดส่ง, ชำระปลายทาง), ติดตามออเดอร์แบบ realtime, รีวิวร้าน/ไรเดอร์, ขอรับของบริจาค, หน้าบัญชีพร้อมสถิติลดขยะ |
| ร้านค้า | แดชบอร์ดยอดขาย (กราฟ 14 วัน, KPI 30 วัน, สินค้าขายดี), จัดการสินค้า, ตารางออเดอร์ (แท็บสถานะ, แบ่งหน้า), แชร์สินค้าให้ชุมชนหรือมูลนิธิ, โลโก้ร้าน, ตั้งพิกัดร้านจาก GPS |
| ไรเดอร์ | เปิด/ปิดรับงาน, Job Pool (ตาราง + รูปสินค้า), รับงานแบบกันชนกัน, อัปเดตสถานะจัดส่ง, ประวัติ + รายได้ค่าส่ง |
| แอดมิน | ยืนยันร้าน/ไรเดอร์, ระงับบัญชี, สถิติแพลตฟอร์ม, รายงานยอดขายต่อร้าน, จัดการมูลนิธิ, สถิติการบริจาค |
| ทุกคน | ลืมรหัสผ่าน, หน้า 404/error ภาษาไทย, เมนูล่างจอบนมือถือ |

ระบบอัตโนมัติ (pg_cron ทุก 10 นาที): ยกเลิกการจองของบริจาคที่ไม่มารับภายใน 24 ชม. และเปลี่ยนสินค้าที่เลยวันหมดอายุเป็น `expired`

---

## เริ่มต้นใช้งาน (local)

ต้องมี Node.js 18+ และโปรเจกต์ Supabase

```bash
npm install
cp .env.local.example .env.local   # แล้วใส่ค่าจริง (ดูหัวข้อ Environment variables)
npm run dev                         # http://localhost:3000
```

### Environment variables

| ตัวแปร | ใช้ที่ไหน | หมายเหตุ |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | แอป | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | แอป | anon (public) key |
| `NEXT_PUBLIC_SITE_URL` | แอป | URL จริงของเว็บ เช่น `https://secondserve.vercel.app` ใช้สร้างลิงก์พรีวิวตอนแชร์ (ไม่ใส่ = `http://localhost:3000`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **เฉพาะ** `npm run seed` | ข้าม RLS ทั้งหมด — ห้ามใส่ใน Vercel ห้าม commit |

### คำสั่ง

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | dev server |
| `NEXT_DIST_DIR=.next-verify npm run build` | build ตรวจโค้ด **โดยไม่ทับ** `.next` ของ dev server ที่รันอยู่ (build ธรรมดาตอน dev รันอยู่จะทำให้ทุกหน้าขาว) |
| `npm run type-check` | `tsc --noEmit` |
| `npm run seed` | สร้างบัญชีเดโม 1 บทบาทละ 1 บัญชี + สินค้าตัวอย่าง (ต้องมี service role key) |
| `npm run audit:security` | ยิง API ตรงด้วยทุกบทบาท 60 รูปแบบ ตรวจ RLS/สิทธิ์/storage — **สร้างบัญชี `audit-*` ในฐานข้อมูลจริง** ต้องรัน `docs/cleanup-test-accounts.sql` ตามหลังเสมอ |

---

## ฐานข้อมูล (Supabase)

SQL ทั้งหมดอยู่ใน [`docs/`](./docs) รันใน Supabase → SQL Editor (วางทั้งไฟล์แล้วกด Run ทุกไฟล์จบด้วย SELECT ตรวจผลให้เห็นทันที)

### ตั้งโปรเจกต์ใหม่ — ลำดับการรัน

1. [`schema-core-tables.sql`](./docs/schema-core-tables.sql) (ตาราง `profiles` / `stores` / `riders`) → [`fix-auth-signup.sql`](./docs/fix-auth-signup.sql) → [`migration-plan-schema.sql`](./docs/migration-plan-schema.sql)
2. ฟีเจอร์ตามลำดับ: `migration-m2-products` → `m4-orders` → `m5-realtime` → `m6-store-orders` → `m7-rider-delivery` → `m8-shares` → `m9-admin` → `m11-reviews`
3. ส่วนขยายและการแก้ไข: `fix-expiry-gate`, `fix-public-shares`, `fix-job-pool-items`, `fix-product-visibility`, `fix-rider-reviews`, `fix-admin-store-sales`, `fix-profiles-visibility`, `fix-product-update-race`, `share-claims`, `foundations`, `fix-anon-is-admin`, `fix-reviewer-privacy`, `fix-column-privileges`, `fix-admin-signup`, `fix-storage-and-shared-status`, `add-categories`, `claim-timeout-and-store-logo` (ไฟล์ชื่อ `migration-<ชื่อ>.sql`)
4. **ปิดท้ายด้วย** [`rls-policies.sql`](./docs/rls-policies.sql) — สถานะสุดท้ายของ RLS policy และฟังก์ชันทั้งหมด รันซ้ำได้ปลอดภัย และใช้ตรวจว่าไม่มี environment ไหนขาดการแก้ (ผลตรวจที่ถูกต้อง: 30 policies + 29 functions)

ไม่ต้องรัน `migration-m12-push.sql` (ฟีเจอร์ถูกถอดออกแล้ว — `migration-remove-push.sql` เก็บไว้เป็นประวัติ)

### ตั้งค่าใน Supabase Dashboard
- **Database → Extensions:** เปิด `pg_cron` (ใช้กับงานอัตโนมัติ)
- **Authentication → URL Configuration:** Site URL = โดเมนจริง, Redirect URLs เพิ่ม `http://localhost:3000/**` และ `https://<โดเมนจริง>/**` (ใช้กับลิงก์ลืมรหัสผ่าน)
- **Authentication → SMTP:** อีเมลมาตรฐานของ Supabase ส่งถึงเฉพาะสมาชิกทีมโปรเจกต์ — ถ้าจะให้ผู้ใช้จริงได้รับอีเมลรีเซ็ตรหัสผ่าน ต้องตั้ง SMTP เอง
- **สร้างแอดมิน:** สมัครบัญชีปกติ แล้วรัน
  `update public.profiles set role = 'admin' where id = (select id from auth.users where email = '...');`
  (สมัครเป็นแอดมินเองผ่านเว็บหรือ API ไม่ได้โดยตั้งใจ)

---

## Deploy (Vercel)

1. Push repo ขึ้น GitHub (แนะนำ Private)
2. vercel.com → Add New Project → Import repo (Framework: Next.js, ค่าอื่นใช้ค่าเริ่มต้น)
3. ใส่ env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` (**ไม่ใส่** service role key)
4. Deploy แล้วเพิ่มโดเมนที่ได้ใน Supabase → Authentication → URL Configuration
5. ทดสอบ: ล็อกอินทุกบทบาท, สั่งซื้อ → ร้านยืนยัน → ไรเดอร์ส่ง, แล้วรัน `npm run audit:security` + cleanup

---

## ก่อนเปิดให้ผู้ใช้จริง (checklist)

1. **ข้อมูลผู้ให้บริการใน [`src/lib/legal.ts`](./src/lib/legal.ts)** — ตอนนี้ตั้งใจเว้นไว้ หน้า `/privacy` และ `/terms` จึงใช้คำกลาง ๆ ("ผู้ให้บริการแพลตฟอร์ม SecondServe" / "ผู้ดูแลระบบ") ก่อนเปิดให้คนทั่วไปใช้ PDPA กำหนดให้ระบุตัวผู้ควบคุมข้อมูลและช่องทางติดต่อ — ใส่ `name` / `email` ในไฟล์นี้แล้วทั้งสองหน้าจะแสดงเอง และควรให้ผู้มีความรู้ด้านกฎหมายตรวจเนื้อหา
2. **ตั้ง SMTP** (Supabase → Project Settings → Authentication → SMTP Settings) — เช่น Gmail (App Password) หรือ Brevo ซึ่งส่งได้โดยไม่ต้องมีโดเมนของตัวเอง
3. **เปิดยืนยันอีเมล** (Authentication → Sign In / Providers → Email → *Confirm email*) — ทำ**หลัง**ข้อ 2 เท่านั้น ไม่งั้นผู้ใช้ใหม่จะไม่ได้รับอีเมลและเข้าระบบไม่ได้ แอปรองรับแล้ว: สมัครเสร็จจะขึ้นหน้า "ยืนยันอีเมล" และลิงก์ในอีเมลพากลับมาที่เว็บ
4. **URL Configuration** ใส่โดเมนจริงทั้ง Site URL และ Redirect URLs
5. ทดสอบด้วยอีเมลจริง: สมัคร → ได้อีเมลยืนยัน → กดลิงก์ → เข้าระบบได้, และลืมรหัสผ่าน → ได้อีเมล → ตั้งรหัสใหม่ได้

การยินยอมตาม PDPA ถูกบันทึกตอนสมัครใน `auth.users.raw_user_meta_data` (`privacy_version`, `privacy_accepted_at`) — เปลี่ยน `PRIVACY_VERSION` ทุกครั้งที่แก้เนื้อหานโยบาย

---

## โครงสร้างโปรเจกต์

```
src/
  app/
    (public)/     หน้าแรก, /products, /products/[id], /stores/[id], /shares
    (auth)/       login, register, forgot-password, reset-password, auth/callback
    (consumer)/   checkout, orders, claims, account
    (store)/      dashboard/store/*
    (rider)/      dashboard/rider/*
    (admin)/      dashboard/admin/*
  components/     ui/ (Button, Card, PageHeader, Pagination, Skeleton…), shared/, consumer/, store/, rider/, admin/
  lib/
    actions/      Server Actions (ทุกการเขียนข้อมูล ผ่าน Zod ก่อน)
    queries/      การอ่านข้อมูลฝั่ง server
    validation/   Zod schemas
    supabase/     client / server / middleware helpers
  middleware.ts   คัดกรองเส้นทางตามบทบาท (ชั้นแรก — ความปลอดภัยจริงอยู่ที่ RLS)
docs/             แผนงาน, schema, SQL migrations, rls-policies.sql
scripts/          seed.mjs, security-audit.mjs
```

### หลักการความปลอดภัย
- **RLS คือเส้นแบ่งจริง** — middleware และ layout เป็นแค่การพาไปหน้าที่ถูก
- การเขียนที่มีความเสี่ยง (สั่งซื้อ, ตัดสต็อก, รับงาน, บริจาค, แอดมิน) ทำผ่านฟังก์ชัน `SECURITY DEFINER` ที่ตรวจสิทธิ์ซ้ำในฐานข้อมูลเท่านั้น
- ผู้ใช้แก้ได้เฉพาะคอลัมน์ทั่วไปของตัวเอง (column grants) — `role`, `suspended`, `verified` แก้ตรงไม่ได้
- รูปสินค้า/โลโก้อยู่ใน `products/<store_id>/` และเขียนได้เฉพาะร้านเจ้าของโฟลเดอร์

---

## เอกสารเพิ่มเติม

- [`docs/implementation-plan.md`](./docs/implementation-plan.md) — แผนงานรายโมดูล สถานะ และบันทึกการแก้ไข
- [`docs/requirements.md`](./docs/requirements.md) · [`docs/scope.md`](./docs/scope.md) · [`docs/architecture.md`](./docs/architecture.md) · [`docs/database.md`](./docs/database.md)
