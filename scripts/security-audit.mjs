// SecondServe security audit -- `npm run audit:security`.
//
// Hits the Supabase REST / RPC / Storage APIs directly with each role's own
// JWT, the way an attacker would (bypassing the web UI), and prints PASS/FAIL
// per probe. Every probe targets a non-existent id or data owned by the
// throwaway audit-* accounts it creates -- never real users' rows.
//
// Side effects on the LIVE project: creates up to six audit-*@test.local
// accounts (reused on later runs) and one product for audit-store-b. Remove
// them afterwards with docs/cleanup-test-accounts.sql. Exits 1 on any FAIL.
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PW = 'AuditPass1234!';
const results = [];

async function api(path, { token = ANON, method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(URL_ + path, {
    method,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...headers,
    },
    body: body === undefined ? undefined : typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

/** Record a probe. `blocked` = the attack failed (good). */
function check(area, attack, blocked, detail = '') {
  results.push({ area, attack, ok: blocked, detail });
}
const rows = (r) => (Array.isArray(r.json) ? r.json.length : 0);
const denied = (r) => r.status >= 400 || rows(r) === 0;

async function signup(tag, role, extra = {}) {
  const email = `audit-${tag}@test.local`;
  let r = await api('/auth/v1/signup', {
    method: 'POST',
    body: { email, password: PW, data: { role, full_name: `Audit ${tag}`, phone: '0811111111', ...extra } },
  });
  if (!r.json.access_token) {
    r = await api('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password: PW } });
  }
  if (!r.json.access_token) throw new Error(`signup ${tag}: ${JSON.stringify(r.json)}`);
  return { token: r.json.access_token, id: r.json.user.id, email };
}

const FAKE = '00000000-0000-0000-0000-0000000000aa';

const cA = await signup('consumer-a', 'consumer');
const cB = await signup('consumer-b', 'consumer');
const sA = await signup('store-a', 'store', { store_name: 'Audit Store A', store_address: 'audit' });
const sB = await signup('store-b', 'store', { store_name: 'Audit Store B', store_address: 'audit' });
const rd = await signup('rider', 'rider', { vehicle_type: 'motorcycle', license_plate: 'AUDIT-1' });
const adm = await signup('admin-try', 'admin');

const storeOf = async (u) => (await api(`/rest/v1/stores?select=id&owner_id=eq.${u.id}`, { token: u.token })).json[0]?.id;
const storeA = await storeOf(sA);
const storeB = await storeOf(sB);

// ---------------------------------------------------------------- signup
{
  const r = await api(`/rest/v1/profiles?select=role&id=eq.${adm.id}`, { token: adm.token });
  const role = r.json[0]?.role;
  check('signup', 'สมัครด้วย role=admin ผ่าน API', role !== 'admin', `ได้ role = ${role}`);
}

// ---------------------------------------------------------------- profiles
for (const [label, u] of [['anon', { token: ANON }], ['consumer A', cA], ['store A', sA], ['rider', rd]]) {
  const r = await api(`/rest/v1/profiles?select=id,phone&id=eq.${cB.id}`, { token: u.token });
  check('profiles', `${label} อ่านโปรไฟล์ (เบอร์โทร) ของ consumer B`, rows(r) === 0, `${rows(r)} แถว`);
}
{
  const r = await api(`/rest/v1/profiles?id=eq.${cA.id}`, { token: cA.token, method: 'PATCH', body: { role: 'admin' } });
  check('profiles', 'consumer A เปลี่ยน role ตัวเองเป็น admin', denied(r), `HTTP ${r.status}`);
  const r2 = await api(`/rest/v1/profiles?id=eq.${cA.id}`, { token: cA.token, method: 'PATCH', body: { suspended: true } });
  check('profiles', 'consumer A แก้ suspended ของตัวเอง', denied(r2), `HTTP ${r2.status}`);
  const r3 = await api(`/rest/v1/profiles?id=eq.${cB.id}`, { token: cA.token, method: 'PATCH', body: { full_name: 'hacked' } });
  check('profiles', 'consumer A แก้ชื่อของ consumer B', denied(r3), `HTTP ${r3.status}, ${rows(r3)} แถว`);
  const r4 = await api(`/rest/v1/profiles?id=eq.${cA.id}`, { token: cA.token, method: 'PATCH', body: { full_name: 'Audit consumer-a ok' } });
  check('profiles', '(ควรทำได้) consumer A แก้ชื่อตัวเอง', !denied(r4) === true, `HTTP ${r4.status}, ${rows(r4)} แถว`);
  const r5 = await api(`/rest/v1/profiles?id=eq.${cA.id}`, { token: cA.token, method: 'DELETE' });
  check('profiles', 'consumer A ลบโปรไฟล์ตัวเอง', denied(r5), `HTTP ${r5.status}`);
}

// ---------------------------------------------------------------- stores / riders
{
  const r = await api(`/rest/v1/stores?id=eq.${storeA}`, { token: sA.token, method: 'PATCH', body: { verified: true } });
  check('stores', 'store A ยืนยันร้านตัวเอง (verified=true)', denied(r), `HTTP ${r.status}`);
  const r2 = await api(`/rest/v1/stores?id=eq.${storeB}`, { token: sA.token, method: 'PATCH', body: { name: 'hacked' } });
  check('stores', 'store A แก้ชื่อร้านของ store B', denied(r2), `HTTP ${r2.status}, ${rows(r2)} แถว`);
  const r3 = await api(`/rest/v1/stores?id=eq.${storeA}`, { token: sA.token, method: 'PATCH', body: { owner_id: sB.id } });
  check('stores', 'store A โอนร้านตัวเองให้คนอื่น (owner_id)', denied(r3), `HTTP ${r3.status}`);
  const r4 = await api('/rest/v1/stores', { token: cA.token, method: 'POST', body: { owner_id: cA.id, name: 'x', address: 'x', latitude: 0, longitude: 0, phone: '0' } });
  check('stores', 'consumer A สร้างร้านเองผ่าน API', denied(r4), `HTTP ${r4.status}`);
  const r5 = await api(`/rest/v1/riders?id=eq.${rd.id}`, { token: rd.token, method: 'PATCH', body: { verified: true } });
  check('riders', 'rider ยืนยันตัวเอง (verified=true)', denied(r5), `HTTP ${r5.status}`);
  const r6 = await api(`/rest/v1/riders?id=eq.${rd.id}`, { token: rd.token, method: 'PATCH', body: { status: 'available' } });
  check('riders', 'rider เปลี่ยน status ตรง (ข้าม set_rider_shift)', denied(r6), `HTTP ${r6.status}`);
  const r7 = await api(`/rest/v1/riders?select=id,license_plate&id=eq.${rd.id}`, { token: cA.token });
  check('riders', 'consumer A อ่านข้อมูลไรเดอร์ (ทะเบียนรถ)', rows(r7) === 0, `${rows(r7)} แถว`);
}

// ---------------------------------------------------------------- products
const productBody = (storeId) => ({
  store_id: storeId, name: 'Audit item', category: 'dry', original_price: 100, discount_price: 50,
  quantity: 5, expiry_date: new Date(Date.now() + 86400e3 * 3).toISOString(),
  image_url: 'https://example.com/x.jpg',
});
let productB;
{
  const r = await api('/rest/v1/products', { token: sB.token, method: 'POST', body: productBody(storeB) });
  productB = r.json[0]?.id;
  check('products', '(ควรทำได้) store B ลงสินค้าของตัวเอง', !!productB, `HTTP ${r.status}`);
  const r2 = await api('/rest/v1/products', { token: sA.token, method: 'POST', body: productBody(storeB) });
  check('products', 'store A ลงสินค้าในนามร้าน store B', denied(r2), `HTTP ${r2.status}`);
  const r3 = await api('/rest/v1/products', { token: cA.token, method: 'POST', body: productBody(storeA) });
  check('products', 'consumer A ลงสินค้า', denied(r3), `HTTP ${r3.status}`);
  const r4 = await api(`/rest/v1/products?id=eq.${productB}`, { token: sA.token, method: 'PATCH', body: { discount_price: 1 } });
  check('products', 'store A แก้ราคาสินค้าของ store B', denied(r4), `HTTP ${r4.status}, ${rows(r4)} แถว`);
  const r5 = await api(`/rest/v1/products?id=eq.${productB}`, { token: sA.token, method: 'DELETE' });
  check('products', 'store A ลบสินค้าของ store B', denied(r5), `HTTP ${r5.status}, ${rows(r5)} แถว`);
  const r6 = await api(`/rest/v1/products?id=eq.${productB}`, { token: sB.token, method: 'PATCH', body: { store_id: storeA } });
  check('products', 'store B ย้ายสินค้าไปอยู่ร้าน store A', denied(r6), `HTTP ${r6.status}`);
  const r7 = await api(`/rest/v1/products?id=eq.${productB}`, { token: sB.token, method: 'PATCH', body: { status: 'shared' } });
  const fake = !denied(r7);
  check('products', 'store B ตั้ง status=shared ตรง (ข้าม share_product → ไม่มี log บริจาค)', !fake, `HTTP ${r7.status}, ${rows(r7)} แถว`);
  if (fake) await api(`/rest/v1/products?id=eq.${productB}`, { token: sB.token, method: 'PATCH', body: { status: 'active' } });
}

// ---------------------------------------------------------------- orders / items / tables with no client writes
for (const [table, body] of [
  ['orders', { consumer_id: cA.id, store_id: storeA, delivery_type: 'pickup', total_amount: 1 }],
  ['order_items', { order_id: FAKE, product_id: productB, quantity: 1, unit_price: 0 }],
  ['shares', { store_id: storeA, product_id: productB, quantity: 1, remaining: 1 }],
  ['share_claims', { share_id: FAKE, claimer_id: cA.id, quantity: 1 }],
  ['reviews', { order_id: FAKE, consumer_id: cA.id, store_id: storeA, rating: 5 }],
  ['foundations', { name: 'Audit fake foundation' }],
]) {
  const r = await api(`/rest/v1/${table}`, { token: cA.token, method: 'POST', body });
  check('direct writes', `consumer A INSERT ตรงเข้า ${table}`, denied(r), `HTTP ${r.status}`);
}
for (const table of ['orders', 'order_items', 'share_claims']) {
  const r = await api(`/rest/v1/${table}?select=id&limit=5`, { token: cB.token });
  check('reads', `consumer B (ไม่มีออเดอร์/คำขอ) อ่าน ${table} ของคนอื่น`, rows(r) === 0, `${rows(r)} แถว`);
  const a = await api(`/rest/v1/${table}?select=id&limit=5`);
  check('reads', `anon อ่าน ${table}`, rows(a) === 0, `${rows(a)} แถว`);
}
{
  const r = await api(`/rest/v1/orders?select=id&limit=5`, { token: rd.token });
  check('reads', 'rider ที่ยังไม่ verified อ่าน Job Pool / ออเดอร์', rows(r) === 0, `${rows(r)} แถว`);
}

// ---------------------------------------------------------------- RPCs that must refuse non-admins / non-owners
const rpcProbes = [
  [cA, 'admin_set_user_suspended', { p_user_id: cB.id, p_suspended: true }],
  [cA, 'admin_set_store_verified', { p_store_id: storeA, p_verified: true }],
  [sA, 'admin_set_store_verified', { p_store_id: storeA, p_verified: true }],
  [rd, 'admin_set_rider_verified', { p_rider_id: rd.id, p_verified: true }],
  [cA, 'admin_list_users', {}],
  [cA, 'admin_platform_metrics', {}],
  [cA, 'admin_store_sales_report', {}],
  [cA, 'admin_save_foundation', { p_id: null, p_name: 'x', p_description: null, p_address: null, p_phone: null, p_active: true }],
  [sA, 'share_product', { p_product_id: productB }],
  [sA, 'update_product', { p_product_id: productB, p_name: 'h', p_category: 'dry', p_original_price: 1, p_discount_price: 1, p_quantity: 1, p_expiry_date: new Date(Date.now() + 864e5).toISOString(), p_image_url: 'x', p_expected_quantity: 5 }],
  [sA, 'place_order', { p_store_id: storeB, p_delivery_type: 'pickup', p_delivery_address: null, p_items: [{ product_id: productB, quantity: 1 }] }],
  [rd, 'claim_delivery_job', { p_order_id: FAKE }],
  [cA, 'confirm_order', { p_order_id: FAKE }],
  [cA, 'mark_foundation_delivered', { p_share_id: FAKE }],
];
for (const [u, fn, args] of rpcProbes) {
  const r = await api(`/rest/v1/rpc/${fn}`, { token: u.token, method: 'POST', body: args });
  const who = u === cA ? 'consumer A' : u === sA ? 'store A' : 'rider';
  check('rpc', `${who} เรียก ${fn}`, r.status >= 400, `HTTP ${r.status} ${r.json?.message ?? ''}`.slice(0, 80));
}
for (const fn of ['admin_list_users', 'claim_share', 'share_product', 'place_order']) {
  const r = await api(`/rest/v1/rpc/${fn}`, { method: 'POST', body: {} });
  check('rpc', `anon เรียก ${fn}`, r.status >= 400, `HTTP ${r.status}`);
}

// ---------------------------------------------------------------- storage (product images)
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
const objB = `${storeB}/audit-${Date.now()}.png`;
{
  const up = await api(`/storage/v1/object/products/${objB}`, { token: sB.token, method: 'POST', body: png, headers: { 'Content-Type': 'image/png' } });
  check('storage', '(ควรทำได้) store B อัปโหลดรูปในโฟลเดอร์ร้านตัวเอง', up.status < 300, `HTTP ${up.status}`);
  const over = await api(`/storage/v1/object/products/${objB}`, { token: sA.token, method: 'PUT', body: png, headers: { 'Content-Type': 'image/png', 'x-upsert': 'true' } });
  check('storage', 'store A เขียนทับรูปสินค้าของ store B', over.status >= 400, `HTTP ${over.status}`);
  const del = await api(`/storage/v1/object/products`, { token: sA.token, method: 'DELETE', body: { prefixes: [objB] } });
  const deleted = Array.isArray(del.json) && del.json.length > 0;
  check('storage', 'store A ลบรูปสินค้าของ store B', !deleted, `HTTP ${del.status}, ลบไป ${Array.isArray(del.json) ? del.json.length : 0} ไฟล์`);
  const intoB = await api(`/storage/v1/object/products/${storeB}/audit-planted-${Date.now()}.png`, { token: sA.token, method: 'POST', body: png, headers: { 'Content-Type': 'image/png' } });
  check('storage', 'store A อัปโหลดไฟล์เข้าโฟลเดอร์ของ store B', intoB.status >= 400, `HTTP ${intoB.status}`);
  const cons = await api(`/storage/v1/object/products/${storeA}/audit-consumer-${Date.now()}.png`, { token: cA.token, method: 'POST', body: png, headers: { 'Content-Type': 'image/png' } });
  check('storage', 'consumer A อัปโหลดรูปเข้าคลังสินค้า', cons.status >= 400, `HTTP ${cons.status}`);
  // leave nothing behind: the owner removes whatever audit files exist
  for (const u of [sA, sB]) {
    for (const s of [storeA, storeB]) {
      const list = await api(`/storage/v1/object/list/products`, { token: u.token, method: 'POST', body: { prefix: s, limit: 100 } });
      const names = (Array.isArray(list.json) ? list.json : []).filter((o) => o.name.startsWith('audit')).map((o) => `${s}/${o.name}`);
      if (names.length) await api(`/storage/v1/object/products`, { token: u.token, method: 'DELETE', body: { prefixes: names } });
    }
  }
}

// ---------------------------------------------------------------- report
const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} | ${r.area.padEnd(13)} | ${r.attack} | ${r.detail}`);
console.log(`\n${results.length} probes, ${failed.length} FAIL`);
console.log('Clean up the audit-* accounts with docs/cleanup-test-accounts.sql');
process.exit(failed.length ? 1 : 0);
