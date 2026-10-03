import { Bike, HeartHandshake, Package, Store, Users } from 'lucide-react';
import { MetricCard } from '@/components/admin/MetricCard';
import { getPlatformMetrics } from '@/lib/queries/admin';
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/types/order';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const metrics = await getPlatformMetrics();

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
    </div>
  );
}
