import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { ArrowLeft, Bike, Mail, Phone, ShoppingBag, Store } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { ModerationTable } from '@/components/admin/ModerationTable';
import { UserSuspendToggle } from '@/components/admin/UserSuspendToggle';
import { StoreVerifyToggle } from '@/components/admin/StoreVerifyToggle';
import { RiderVerifyToggle } from '@/components/admin/RiderVerifyToggle';
import { getUserDetail } from '@/lib/queries/admin';
import { SectionTitle } from '@/components/ui/PageHeader';
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/types/order';

export const dynamic = 'force-dynamic';

const ROLE_LABEL: Record<string, string> = {
  consumer: 'ผู้บริโภค',
  store: 'ร้านค้า',
  rider: 'ไรเดอร์',
  admin: 'แอดมิน',
};
const VEHICLE_LABEL: Record<string, string> = { motorcycle: 'มอเตอร์ไซค์', bicycle: 'จักรยาน', car: 'รถยนต์' };
const RIDER_STATUS_LABEL: Record<string, string> = { available: 'พร้อมรับงาน', busy: 'กำลังจัดส่ง', offline: 'ออฟไลน์' };

function formatBaht(n: number): string {
  const v = Number(n);
  const frac = Number.isInteger(v) ? 0 : 2;
  return `฿${v.toLocaleString('th-TH', { minimumFractionDigits: frac, maximumFractionDigits: frac })}`;
}

function formatDate(iso: string | null, withTime = false): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('th-TH', {
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' as const } : {}),
    timeZone: 'Asia/Bangkok',
  });
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-neutral-900">{children}</dd>
    </div>
  );
}

function Stat({ label, value, tone = 'text-neutral-900' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${tone}`}>{value}</p>
    </div>
  );
}

export default async function AdminUserDetailPage({ params }: { params: { id: string } }) {
  const user = await getUserDetail(params.id);
  if (!user) notFound();
  const c = user.consumer;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/admin/users"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-forest-800"
      >
        <ArrowLeft className="h-4 w-4" /> ผู้ใช้ทั้งหมด
      </Link>

      {/* Account */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-neutral-900">{user.full_name}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={user.role} size="sm">
                  {ROLE_LABEL[user.role]}
                </Badge>
                <Badge variant={user.suspended ? 'danger' : 'forest'} size="sm">
                  {user.suspended ? 'ถูกระงับ' : 'ปกติ'}
                </Badge>
              </div>
            </div>
            {user.role !== 'admin' && <UserSuspendToggle userId={user.id} suspended={user.suspended} />}
          </div>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="อีเมล">
              <span className="inline-flex items-center gap-1.5 break-all">
                <Mail className="h-3.5 w-3.5 flex-shrink-0 text-neutral-400" />
                {user.email ?? '-'}
              </span>
            </Field>
            <Field label="เบอร์โทร">
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-neutral-400" />
                {user.phone}
              </span>
            </Field>
            <Field label="ยืนยันอีเมล">
              {user.email_confirmed_at ? formatDate(user.email_confirmed_at) : 'ยังไม่ยืนยัน'}
            </Field>
            <Field label="วันที่สมัคร">{formatDate(user.created_at, true)}</Field>
            <Field label="เข้าสู่ระบบล่าสุด">{formatDate(user.last_sign_in_at, true)}</Field>
            <Field label="รหัสผู้ใช้">
              <span className="font-mono text-xs text-neutral-600">{user.id}</span>
            </Field>
          </dl>
        </CardContent>
      </Card>

      {/* Store */}
      {user.store && (
        <section className="space-y-3">
          <SectionTitle>ข้อมูลร้านค้า</SectionTitle>
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {user.store.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.store.logo_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100">
                      <Store className="h-6 w-6 text-amber-700" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-neutral-900">{user.store.name}</p>
                    <p className="text-sm text-neutral-500">{user.store.address}</p>
                  </div>
                </div>
                <StoreVerifyToggle storeId={user.store.id} verified={user.store.verified} />
              </div>
              <dl className="grid gap-4 sm:grid-cols-3">
                <Field label="เบอร์ร้าน">{user.store.phone}</Field>
                <Field label="ค่าจัดส่ง">{formatBaht(user.store.delivery_fee)}</Field>
                <Field label="พิกัด">
                  {Number(user.store.latitude).toFixed(4)}, {Number(user.store.longitude).toFixed(4)}
                </Field>
              </dl>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="สินค้ากำลังขาย / ทั้งหมด" value={`${user.store.products_active} / ${user.store.products_total}`} />
                <Stat label="ออเดอร์สำเร็จ" value={Number(user.store.orders_completed).toLocaleString()} />
                <Stat label="ยอดขายสินค้า" value={formatBaht(user.store.gross)} />
                <Stat label="ถูกหักคอมมิชชัน" value={`−${formatBaht(user.store.commission)}`} tone="text-orange-600" />
              </div>
              <Link
                href={`/dashboard/admin/commission/${user.store.id}`}
                className="inline-block text-sm font-medium text-forest-800 hover:underline"
              >
                ดูออเดอร์ที่ถูกหักคอมมิชชัน →
              </Link>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Rider */}
      {user.rider && (
        <section className="space-y-3">
          <SectionTitle>ข้อมูลไรเดอร์</SectionTitle>
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100">
                    <Bike className="h-6 w-6 text-sky-700" />
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-900">
                      {VEHICLE_LABEL[user.rider.vehicle_type] ?? user.rider.vehicle_type} · {user.rider.license_plate}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {RIDER_STATUS_LABEL[user.rider.status] ?? user.rider.status}
                    </p>
                  </div>
                </div>
                <RiderVerifyToggle riderId={user.id} verified={user.rider.verified} />
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <Stat label="จัดส่งสำเร็จ" value={`${Number(user.rider.deliveries_completed)} งาน`} />
                <Stat label="รายได้ค่าส่ง" value={formatBaht(user.rider.earnings)} tone="text-forest-800" />
                <Stat
                  label="คะแนนรีวิว"
                  value={
                    user.rider.rating_count > 0
                      ? `${Number(user.rider.rating_avg).toFixed(1)} / 5 (${user.rider.rating_count})`
                      : '-'
                  }
                />
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Purchases (any role can have them, but only consumers can order) */}
      {user.role === 'consumer' && (
        <section className="space-y-3">
          <SectionTitle>การสั่งซื้อและการใช้งาน</SectionTitle>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="ออเดอร์ทั้งหมด" value={Number(c.orders_total).toLocaleString()} />
            <Stat label="ยอดซื้อ (ออเดอร์สำเร็จ)" value={formatBaht(c.spent_total)} tone="text-forest-800" />
            <Stat label="ขอรับของบริจาค" value={`${Number(c.claims_total)} ครั้ง`} />
            <Stat label="รีวิวที่เขียน" value={`${Number(c.reviews_total)} รีวิว`} />
          </div>
          {c.recent_orders.length === 0 ? (
            <p className="rounded-xl border border-dashed border-neutral-200 bg-white p-4 text-sm text-neutral-500">
              ยังไม่มีการสั่งซื้อ
            </p>
          ) : (
            <ModerationTable headers={['วันที่', 'ออเดอร์', 'ร้าน', 'วิธีรับ', 'ยอดรวม', 'สถานะ']}>
              {c.recent_orders.map((o) => (
                <tr key={o.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-600">{formatDate(o.created_at, true)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-700">#{o.id.slice(0, 8).toUpperCase()}</td>
                  <td className="px-4 py-3 text-neutral-800">
                    <span className="inline-flex items-center gap-1">
                      <ShoppingBag className="h-3.5 w-3.5 text-neutral-400" />
                      {o.store_name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{o.delivery_type === 'delivery' ? 'จัดส่ง' : 'รับเอง'}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatBaht(o.total_amount)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={o.status === 'cancelled' ? 'danger' : o.status === 'completed' ? 'forest' : 'warning'} size="sm">
                      {ORDER_STATUS_LABELS[o.status as OrderStatus] ?? o.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </ModerationTable>
          )}
        </section>
      )}
    </div>
  );
}
