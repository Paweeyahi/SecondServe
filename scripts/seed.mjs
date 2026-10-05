// Demo data seeder for SecondServe (M10). Creates one account per role
// (consumer/store/rider/admin) plus a handful of near-expiry products on the
// demo store, so a fresh environment has something to click through without
// manually registering + verifying + adding products by hand.
//
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (Supabase dashboard ->
// Project Settings -> API -> service_role key). This key bypasses RLS
// entirely -- it is only ever read here, server-side, never sent to the
// browser, and must never be committed or reused as an app env var.
//
// Idempotent: safe to run more than once. Existing demo accounts/products
// (matched by fixed email / name) are left as-is rather than duplicated.
//
// Usage: npm run seed

import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal() {
  const path = new URL('../.env.local', import.meta.url);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase dashboard -> ' +
      'Project Settings -> API -> service_role key -- server/seed-only, ' +
      'never expose this to the client or commit it).'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Never hard-code this: the repo may be public and the seed creates an admin.
// Set SEED_DEMO_PASSWORD in .env.local to choose one, otherwise a random one
// is generated and printed at the end (accounts that already exist keep
// whatever password they were created with).
const DEMO_PASSWORD =
  process.env.SEED_DEMO_PASSWORD || `Demo-${crypto.randomUUID().slice(0, 13)}`;

const DEMO_USERS = [
  {
    email: 'demo-consumer@secondserve.local',
    role: 'consumer',
    full_name: 'สมชาย ผู้บริโภค',
    phone: '0811111111',
  },
  {
    email: 'demo-store@secondserve.local',
    role: 'store',
    full_name: 'เจ้าของร้าน สมหญิง',
    phone: '0822222222',
    store_name: 'ร้านสะดวกซื้อสีเขียว',
    store_address: '123 ถนนสุขุมวิท กรุงเทพฯ',
  },
  {
    email: 'demo-rider@secondserve.local',
    role: 'rider',
    full_name: 'ไรเดอร์ วิชัย',
    phone: '0833333333',
    vehicle_type: 'motorcycle',
    license_plate: 'กข-1234',
  },
  {
    // handle_new_user only accepts consumer/store/rider (any other role in
    // signup metadata becomes 'consumer'), so main() promotes this account
    // to admin afterwards with the service-role client.
    email: 'demo-admin@secondserve.local',
    role: 'admin',
    full_name: 'ผู้ดูแลระบบ',
    phone: '0844444444',
  },
];

const DEMO_PRODUCTS = [
  { name: 'ขนมปังโฮลวีท', category: 'bakery', original_price: 65, discount_price: 25, quantity: 12, expiry_days: 2 },
  { name: 'นมสดพาสเจอร์ไรส์', category: 'beverage', original_price: 55, discount_price: 30, quantity: 20, expiry_days: 3 },
  { name: 'สลัดผักรวม', category: 'fresh', original_price: 89, discount_price: 45, quantity: 8, expiry_days: 1 },
  { name: 'ข้าวกล่องผัดกะเพรา', category: 'ready_meal', original_price: 60, discount_price: 30, quantity: 15, expiry_days: 1 },
  { name: 'ถั่วอบแห้งรวม', category: 'dry', original_price: 120, discount_price: 70, quantity: 25, expiry_days: 30 },
];

async function findUserByEmail(email) {
  // The admin API has no "get by email" lookup -- page through listUsers.
  const perPage = 200;
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const found = data.users.find((u) => u.email === email);
    if (found) return found;
    if (data.users.length < perPage) return null;
  }
}

async function ensureUser(def) {
  const existing = await findUserByEmail(def.email);
  if (existing) {
    console.log(`  = ${def.role.padEnd(8)} ${def.email} (already exists)`);
    return existing.id;
  }

  const user_metadata = {
    full_name: def.full_name,
    phone: def.phone,
    role: def.role,
    ...(def.role === 'store' && { store_name: def.store_name, store_address: def.store_address }),
    ...(def.role === 'rider' && { vehicle_type: def.vehicle_type, license_plate: def.license_plate }),
  };

  const { data, error } = await supabase.auth.admin.createUser({
    email: def.email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata,
  });
  if (error) throw new Error(`create ${def.email}: ${error.message}`);

  console.log(`  + ${def.role.padEnd(8)} ${def.email} (created)`);
  return data.user.id;
}

async function uploadProductImage(storeId, seed) {
  const res = await fetch(`https://picsum.photos/seed/${encodeURIComponent(seed)}/600/400`);
  if (!res.ok) throw new Error(`placeholder image fetch failed: ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());

  // Storage keys must be ASCII -- product names are Thai, so hex-encode the seed.
  const path = `${storeId}/seed-${Buffer.from(seed).toString('hex').slice(0, 24)}.jpg`;
  const { error } = await supabase.storage
    .from('products')
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(`upload image for ${seed}: ${error.message}`);

  return supabase.storage.from('products').getPublicUrl(path).data.publicUrl;
}

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function seedProducts(storeId) {
  const { data: existing, error: selectError } = await supabase
    .from('products')
    .select('name')
    .eq('store_id', storeId);
  if (selectError) throw new Error(`list existing products: ${selectError.message}`);
  const existingNames = new Set((existing ?? []).map((p) => p.name));

  for (const p of DEMO_PRODUCTS) {
    if (existingNames.has(p.name)) {
      console.log(`  = product  ${p.name} (already exists)`);
      continue;
    }

    const imageUrl = await uploadProductImage(storeId, p.name.replace(/\s+/g, '-'));
    const { error } = await supabase.from('products').insert({
      store_id: storeId,
      name: p.name,
      category: p.category,
      original_price: p.original_price,
      discount_price: p.discount_price,
      quantity: p.quantity,
      expiry_date: daysFromNow(p.expiry_days),
      image_url: imageUrl,
      status: 'active',
    });
    if (error) throw new Error(`insert product ${p.name}: ${error.message}`);
    console.log(`  + product  ${p.name} (created)`);
  }
}

async function main() {
  console.log('Seeding SecondServe demo data...\n');

  console.log('Users:');
  const ids = {};
  for (const def of DEMO_USERS) {
    ids[def.role] = await ensureUser(def);
  }

  const { error: adminError } = await supabase
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', ids.admin);
  if (adminError) throw new Error(`promote demo admin: ${adminError.message}`);

  // Unverified stores/riders are invisible to consumers / can't go on shift
  // (same gate M9 admin verification enforces normally) -- force-verify the
  // demo ones so the seeded data is immediately usable end to end.
  const { error: storeError } = await supabase
    .from('stores')
    .update({ verified: true })
    .eq('owner_id', ids.store);
  if (storeError) throw new Error(`verify demo store: ${storeError.message}`);

  const { error: riderError } = await supabase
    .from('riders')
    .update({ verified: true })
    .eq('id', ids.rider);
  if (riderError) throw new Error(`verify demo rider: ${riderError.message}`);

  console.log('\nProducts:');
  const { data: store, error: storeSelectError } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', ids.store)
    .single();
  if (storeSelectError || !store) {
    throw new Error(`find demo store row: ${storeSelectError?.message ?? 'not found'}`);
  }
  await seedProducts(store.id);

  console.log(`\nDone. Demo accounts (password for all: ${DEMO_PASSWORD}):`);
  for (const def of DEMO_USERS) {
    console.log(`  ${def.role.padEnd(8)} ${def.email}`);
  }
}

main().catch((err) => {
  console.error('\nSeed failed:', err.message);
  process.exit(1);
});
