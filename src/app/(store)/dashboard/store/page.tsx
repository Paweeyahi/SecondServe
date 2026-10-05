import Link from 'next/link';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ClipboardList,
  HeartHandshake,
  Leaf,
  Package,
  PackageX,
  Percent,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StoreRevenueChart } from '@/components/store/StoreRevenueChart';
import { SectionTitle } from '@/components/ui/PageHeader';
import { getCurrentStore, getStoreProducts } from '@/lib/queries/store';
import { getStoreDashboardData } from '@/lib/queries/store-dashboard';
import { getStoreRatingSummary } from '@/lib/queries/reviews';
import { getReservedClaimCount } from '@/lib/queries/shares';

export const dynamic = 'force-dynamic';

function formatBaht(n: number): string {
  return `฿${n.toLocaleString('th-TH', { maximumFractionDigits: 0 })}`;
}

function formatBahtExact(n: number): string {
  const frac = Number.isInteger(n) ? 0 : 2;
  return `฿${n.toLocaleString('th-TH', { minimumFractionDigits: frac, maximumFractionDigits: frac })}`;
}

/** % change vs the previous period, or null when there is no baseline. */
function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export default async function StoreOverviewPage() {
  const store = await getCurrentStore();
  if (!store) return null;

  const [products, dashboard, rating, reservedClaims] = await Promise.all([
    getStoreProducts(store.id),
    getStoreDashboardData(store.id),
    getStoreRatingSummary(store.id),
    getReservedClaimCount(store.id),
  ]);

  const now = Date.now();
  const active = products.filter(
    (p) => p.status === 'active' && new Date(p.expiry_date).getTime() > now
  );
  const expiringSoon = active.filter(
    (p) => new Date(p.expiry_date).getTime() - now < 24 * 60 * 60 * 1000
  );
  const soldOut = products.filter((p) => p.status === 'sold_out').length;

  const { current, previous, openOrders } = dashboard;
  const revenueDelta = percentChange(current.revenue, previous.revenue);
  const avgOrder = current.completedOrders > 0 ? current.revenue / current.completedOrders : 0;
  const cancelRate =
    current.totalOrders > 0 ? Math.round((current.cancelledOrders / current.totalOrders) * 100) : 0;
  const foodSaved = current.itemsSold + dashboard.sharedQuantity;
  const maxTopQty = Math.max(...dashboard.topProducts.map((p) => p.quantity), 1);
  const commissionPercent = Math.round(dashboard.commission.rate * 10000) / 100;

  const todo = [
    {
      count: openOrders.pending,
      label: 'ออเดอร์ใหม่รอยืนยัน',
      href: '/dashboard/store/orders?status=todo',
    },
    {
      count: openOrders.confirmed,
      label: 'ออเดอร์รอเตรียมสินค้า',
      href: '/dashboard/store/orders?status=todo',
    },
    {
      count: openOrders.ready,
      label: 'ออเดอร์พร้อมส่ง / รอรับ',
      href: '/dashboard/store/orders?status=todo',
    },
    {
      count: reservedClaims,
      label: 'คำขอรับของบริจาค',
      href: '/dashboard/store/shares',
    },
    {
      count: expiringSoon.length,
      label: 'สินค้าจะหมดอายุใน 24 ชม.',
      href: '/dashboard/store/products',
    },
  ].filter((t) => t.count > 0);

  return (
    <div className="space-y-6">
      <div
        className={`flex items-center gap-3 rounded-xl border p-4 text-sm ${
          store.verified
            ? 'border-forest-200 bg-forest-50/60 text-forest-800'
            : 'border-amber-200 bg-amber-50/60 text-amber-900'
        }`}
      >
        {store.verified ? (
          <ShieldCheck className="h-5 w-5 flex-shrink-0" />
        ) : (
          <ShieldAlert className="h-5 w-5 flex-shrink-0" />
        )}
        <span>
          {store.verified
            ? 'ร้านค้าได้รับการอนุมัติแล้ว สินค้าจะแสดงในหน้าค้นหาของผู้บริโภค'
            : 'ร้านค้ายังรอผู้ดูแลระบบอนุมัติ สินค้าจะยังไม่แสดงต่อผู้บริโภคจนกว่าจะอนุมัติ'}
        </span>
      </div>

      {/* Needs attention */}
      <section className="space-y-2">
        <SectionTitle>สิ่งที่ต้องทำ</SectionTitle>
        {todo.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-200 bg-white p-4 text-sm text-neutral-500">
            ไม่มีงานค้าง เยี่ยมมาก!
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {todo.map((t) => (
              <Link
                key={t.label}
                href={t.href}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm transition-colors hover:bg-amber-50"
              >
                <span className="text-amber-900">{t.label}</span>
                <span className="flex items-center gap-1 font-bold text-amber-900">
                  {t.count}
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* KPI row -- last 30 days */}
      <section className="space-y-2">
        <SectionTitle>30 วันล่าสุด</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-neutral-500">ยอดขาย</p>
              <p className="mt-1 text-2xl font-extrabold text-neutral-900">
                {formatBaht(current.revenue)}
              </p>
              {revenueDelta === null ? (
                <p className="mt-1 text-xs text-neutral-400">ยังไม่มีข้อมูลช่วงก่อนหน้า</p>
              ) : (
                <p
                  className={`mt-1 flex items-center gap-0.5 text-xs font-medium ${
                    revenueDelta >= 0 ? 'text-forest-700' : 'text-red-600'
                  }`}
                >
                  {revenueDelta >= 0 ? (
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5" />
                  )}
                  {revenueDelta >= 0 ? '+' : ''}
                  {revenueDelta}% จาก 30 วันก่อนหน้า
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="flex items-center gap-1 text-xs font-medium text-neutral-500">
                <ClipboardList className="h-3.5 w-3.5" /> ออเดอร์สำเร็จ
              </p>
              <p className="mt-1 text-2xl font-extrabold text-neutral-900">
                {current.completedOrders.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                เฉลี่ย {formatBaht(avgOrder)}/ออเดอร์ · ยกเลิก {cancelRate}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="flex items-center gap-1 text-xs font-medium text-neutral-500">
                <Leaf className="h-3.5 w-3.5" /> อาหารที่ไม่ถูกทิ้ง
              </p>
              <p className="mt-1 text-2xl font-extrabold text-neutral-900">
                {foodSaved.toLocaleString()} <span className="text-sm font-semibold">ชิ้น</span>
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                ขาย {current.itemsSold.toLocaleString()} · ส่งต่อ{' '}
                {dashboard.sharedQuantity.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="flex items-center gap-1 text-xs font-medium text-neutral-500">
                <Star className="h-3.5 w-3.5" /> คะแนนร้าน
              </p>
              <p className="mt-1 text-2xl font-extrabold text-neutral-900">
                {rating.count > 0 ? rating.average.toFixed(1) : '-'}
                <span className="text-sm font-semibold text-neutral-500"> / 5</span>
              </p>
              <Link
                href={`/stores/${store.id}`}
                className="mt-1 inline-block text-xs text-neutral-500 underline hover:text-forest-700"
              >
                {rating.count} รีวิวทั้งหมด
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Platform commission */}
      <section className="space-y-2">
        <SectionTitle subtitle="ระบบหักอัตโนมัติจากยอดขายสินค้าของออเดอร์ที่สำเร็จ ไม่รวมค่าจัดส่ง">
          ค่าคอมมิชชันแพลตฟอร์ม
        </SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="flex items-center gap-1 text-xs font-medium text-neutral-500">
                <Percent className="h-3.5 w-3.5" /> อัตราที่หัก
              </p>
              <p className="mt-1 text-2xl font-extrabold text-neutral-900">{commissionPercent}%</p>
              <p className="mt-1 text-xs text-neutral-500">ของยอดขายสินค้าแต่ละออเดอร์</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-neutral-500">ถูกหัก 30 วันล่าสุด</p>
              <p className="mt-1 text-2xl font-extrabold text-orange-600">
                −{formatBahtExact(current.commission)}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                จากยอดขาย {formatBahtExact(current.revenue)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-neutral-500">ถูกหักทั้งหมด</p>
              <p className="mt-1 text-2xl font-extrabold text-orange-600">
                −{formatBahtExact(dashboard.commission.allTimeCommission)}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                จากยอดขายสะสม {formatBahtExact(dashboard.commission.allTimeRevenue)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-neutral-500">รายได้สุทธิ 30 วันล่าสุด</p>
              <p className="mt-1 text-2xl font-extrabold text-forest-800">
                {formatBahtExact(current.revenue - current.commission)}
              </p>
              <p className="mt-1 text-xs text-neutral-500">ยอดขาย − ค่าคอมมิชชัน</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <StoreRevenueChart daily={dashboard.daily} />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Best sellers */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-neutral-900">สินค้าขายดี 30 วันล่าสุด</h3>
          {dashboard.topProducts.length === 0 ? (
            <p className="text-sm text-neutral-500">ยังไม่มียอดขาย</p>
          ) : (
            <ol className="space-y-3">
              {dashboard.topProducts.map((p, i) => (
                <li key={p.productId} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-neutral-800">
                      <span className="mr-1.5 text-neutral-400">{i + 1}.</span>
                      {p.name}
                    </span>
                    <span className="flex-shrink-0 text-neutral-600">
                      {p.quantity} ชิ้น · {formatBaht(p.revenue)}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-neutral-100">
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${(p.quantity / maxTopQty) * 100}%`, backgroundColor: '#2a78d6' }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Stock */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-neutral-900">สต็อกตอนนี้</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-neutral-50 p-3">
              <Package className="mx-auto h-5 w-5 text-forest-700" />
              <p className="mt-1 text-xl font-bold text-neutral-900">{active.length}</p>
              <p className="text-xs text-neutral-500">กำลังขาย</p>
            </div>
            <div className="rounded-xl bg-neutral-50 p-3">
              <PackageX className="mx-auto h-5 w-5 text-amber-600" />
              <p className="mt-1 text-xl font-bold text-neutral-900">{soldOut}</p>
              <p className="text-xs text-neutral-500">ของหมด</p>
            </div>
            <div className="rounded-xl bg-neutral-50 p-3">
              <HeartHandshake className="mx-auto h-5 w-5 text-emerald-700" />
              <p className="mt-1 text-xl font-bold text-neutral-900">
                {products.filter((p) => p.status === 'shared').length}
              </p>
              <p className="text-xs text-neutral-500">ส่งต่อแล้ว</p>
            </div>
          </div>
          <Link href="/dashboard/store/products/new" className="mt-4 block">
            <Button variant="primary" className="w-full" leftIcon={<Plus className="h-4 w-4" />}>
              เพิ่มสินค้าใหม่
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
