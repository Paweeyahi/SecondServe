import Link from 'next/link';
import { Bike, HeartHandshake, Package, Percent, Store, Users } from 'lucide-react';
import { MetricCard } from '@/components/admin/MetricCard';
import { CommissionRateForm } from '@/components/admin/CommissionRateForm';
import { StoreSalesChart } from '@/components/admin/StoreSalesChart';
import {
  getCommissionSummary,
  getDonationOverview,
  getPlatformMetrics,
  getStoreSalesReport,
} from '@/lib/queries/admin';
import { getCommunityShareStats } from '@/lib/queries/shares';
import { SectionTitle } from '@/components/ui/PageHeader';
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/types/order';

export const dynamic = 'force-dynamic';

function formatBaht(n: number): string {
  const frac = Number.isInteger(n) ? 0 : 2;
  return `฿${n.toLocaleString('th-TH', { minimumFractionDigits: frac, maximumFractionDigits: frac })}`;
}

export default async function AdminDashboardPage() {
  const [metrics, shareStats, donations, commission, salesReport] = await Promise.all([
    getPlatformMetrics(),
    getCommunityShareStats(),
    getDonationOverview(),
    getCommissionSummary(),
    getStoreSalesReport(),
  ]);
  const ratePercent = commission ? Math.round(commission.rate * 10000) / 100 : 10;
  const commissionTiles = commission
    ? [
        { label: 'หักคอมมิชชันแล้วทั้งหมด', value: formatBaht(commission.commission_total), tone: 'text-orange-600', hint: `จาก ${commission.completed_orders.toLocaleString()} ออเดอร์ที่สำเร็จ` },
        { label: 'หักใน 30 วันล่าสุด', value: formatBaht(commission.commission_30d), tone: 'text-orange-600', hint: `จากยอดขาย ${formatBaht(commission.gross_30d)}` },
        { label: 'ยอดขายสินค้ารวม', value: formatBaht(commission.gross), tone: 'text-neutral-900', hint: 'ไม่รวมค่าจัดส่งของไรเดอร์' },
        { label: 'สุทธิที่ร้านค้าได้รับ', value: formatBaht(commission.net_to_stores), tone: 'text-forest-800', hint: 'ยอดขาย − คอมมิชชัน' },
      ]
    : [];
  const donationTiles = [
    { label: 'ส่งต่อทั้งหมด', value: shareStats.totalQuantity, tone: 'text-forest-900' },
    { label: 'ผู้รับมารับแล้ว', value: donations.claims.collected, tone: 'text-forest-800' },
    { label: 'ส่งถึงมูลนิธิแล้ว', value: shareStats.foundationDeliveredQuantity, tone: 'text-forest-800' },
    { label: 'รอผู้รับมารับ', value: donations.claims.reserved, tone: 'text-orange-600' },
    { label: 'ยกเลิกเพราะไม่มารับ', value: donations.claims.timedOut, tone: 'text-red-600' },
    { label: 'ยังเปิดให้ขอรับ', value: shareStats.availableQuantity, tone: 'text-forest-800' },
  ];
  const maxStoreQty = Math.max(...donations.topStores.map((s) => s.quantity), 1);
  const maxFoundationQty = Math.max(...shareStats.foundations.map((f) => f.deliveredQuantity), 1);

  const foodWasteDiverted =
    (metrics?.shares_quantity_total ?? 0) + (metrics?.delivered_items_quantity_total ?? 0);
  const ordersTotal = metrics
    ? Object.values(metrics.orders_by_status).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <MetricCard
          label="ร้านค้าทั้งหมด"
          value={metrics?.stores_total ?? '-'}
          icon={<Store className="h-5 w-5 text-amber-600" />}
          hint={`ยืนยันแล้ว ${metrics?.stores_verified ?? 0} ร้าน`}
          href="/dashboard/admin/stores"
        />
        <MetricCard
          label="ไรเดอร์ทั้งหมด"
          value={metrics?.riders_total ?? '-'}
          icon={<Bike className="h-5 w-5 text-sky-600" />}
          hint={`ยืนยันแล้ว ${metrics?.riders_verified ?? 0} คน`}
          href="/dashboard/admin/riders"
        />
        <MetricCard
          label="ผู้บริโภคทั้งหมด"
          value={metrics?.consumers_total ?? '-'}
          icon={<Users className="h-5 w-5 text-emerald-600" />}
          hint={`ถูกระงับ ${metrics?.users_suspended ?? 0} บัญชี`}
          href="/dashboard/admin/users?role=consumer"
        />
        <MetricCard
          label="อาหารที่กู้คืนได้ (ชิ้น)"
          value={foodWasteDiverted}
          icon={<HeartHandshake className="h-5 w-5 text-forest-700" />}
          hint="ยอดสั่งซื้อที่จัดส่งสำเร็จ + สินค้าที่แชร์ให้ชุมชน"
          href="/shares"
        />
        <MetricCard
          label="ออเดอร์ทั้งหมด"
          value={metrics ? ordersTotal : '-'}
          icon={<Package className="h-5 w-5 text-neutral-600" />}
        />
      </div>

      {metrics && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-neutral-900">ออเดอร์แยกตามสถานะ</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(metrics.orders_by_status).map(([status, count]) => (
              <div key={status} className="rounded-xl bg-neutral-50 p-3 text-center">
                <p className="text-xl font-bold text-neutral-900">{count}</p>
                <p className="text-xs text-neutral-500">
                  {ORDER_STATUS_LABELS[status as OrderStatus] ?? status}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Platform commission */}
      <section className="space-y-4">
        <SectionTitle subtitle="ระบบหักอัตโนมัติจากยอดขายสินค้าของทุกออเดอร์ที่สำเร็จ (ไม่รวมค่าจัดส่ง) แต่ละออเดอร์ใช้อัตรา ณ เวลาที่สั่งซื้อ">
          รายได้แพลตฟอร์ม (ค่าคอมมิชชัน)
        </SectionTitle>
        {commission ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-2xl border border-forest-200 bg-forest-50/60 p-4 shadow-sm">
              <p className="flex items-center gap-1 text-xs font-medium text-neutral-500">
                <Percent className="h-3.5 w-3.5" /> อัตราปัจจุบัน
              </p>
              <p className="mt-1 text-2xl font-extrabold text-forest-900">{ratePercent}%</p>
              <div className="mt-2">
                <CommissionRateForm ratePercent={ratePercent} />
              </div>
            </div>
            {commissionTiles.map((t) => (
              <div key={t.label} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-neutral-500">{t.label}</p>
                <p className={`mt-1 text-2xl font-extrabold ${t.tone}`}>{t.value}</p>
                <p className="mt-1 text-xs text-neutral-500">{t.hint}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-neutral-200 bg-white p-4 text-sm text-neutral-500">
            ยังโหลดข้อมูลค่าคอมมิชชันไม่ได้ (ตรวจว่ารัน docs/migration-commission.sql แล้ว)
          </p>
        )}
        <StoreSalesChart report={salesReport} ratePercent={ratePercent} />
      </section>

      {/* Donations */}
      <section className="space-y-4">
        <SectionTitle subtitle="หน่วยเป็นชิ้น รวมทั้งการแบ่งปันให้ชุมชนและการมอบให้มูลนิธิ">
          การบริจาคและส่งต่ออาหาร
        </SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {donationTiles.map((t) => (
            <div key={t.label} className="rounded-2xl border border-neutral-200 bg-white p-4 text-center shadow-sm">
              <p className={`text-2xl font-extrabold ${t.tone}`}>{t.value.toLocaleString()}</p>
              <p className="mt-0.5 text-xs text-neutral-500">{t.label}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-neutral-900">ร้านที่ส่งต่ออาหารมากที่สุด</h3>
            {donations.topStores.length === 0 ? (
              <p className="text-sm text-neutral-500">ยังไม่มีการส่งต่อ</p>
            ) : (
              <ol className="space-y-3">
                {donations.topStores.map((st, i) => (
                  <li key={st.storeId} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate text-neutral-800">
                        <span className="mr-1.5 text-neutral-400">{i + 1}.</span>
                        {st.name}
                      </span>
                      <span className="flex-shrink-0 text-neutral-600">
                        {st.quantity.toLocaleString()} ชิ้น · {st.donations} ครั้ง
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-neutral-100">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${(st.quantity / maxStoreQty) * 100}%`, backgroundColor: '#2a78d6' }}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-neutral-900">มูลนิธิที่ได้รับ (ที่เปิดรับอยู่)</h3>
              <Link href="/dashboard/admin/foundations" className="text-xs font-medium text-forest-800 hover:underline">
                จัดการมูลนิธิ
              </Link>
            </div>
            {shareStats.foundations.length === 0 ? (
              <p className="text-sm text-neutral-500">ยังไม่มีมูลนิธิในระบบ</p>
            ) : (
              <ul className="space-y-3">
                {shareStats.foundations.map((f) => (
                  <li key={f.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate text-neutral-800">{f.name}</span>
                      <span className="flex-shrink-0 text-neutral-600">
                        {f.deliveredQuantity.toLocaleString()} ชิ้น
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-neutral-100">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${(f.deliveredQuantity / maxFoundationQty) * 100}%`,
                          backgroundColor: '#2a78d6',
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
