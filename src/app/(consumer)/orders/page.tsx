import Link from 'next/link';
import { ChevronRight, Package, ShoppingBag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/types/order';
import { getMyOrders } from '@/lib/queries/orders';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'ออเดอร์ของฉัน — SecondServe' };

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

export default async function OrdersPage() {
  const orders = await getMyOrders();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <PageHeader icon={ShoppingBag} title="ออเดอร์ของฉัน" subtitle="ติดตามสถานะคำสั่งซื้อทั้งหมดของคุณ" />
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <Package className="h-10 w-10 text-neutral-300" />
            <p className="text-sm text-neutral-500">ยังไม่มีคำสั่งซื้อ</p>
            <Link href="/products">
              <Button variant="primary">เลือกซื้อสินค้า</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`}>
              <Card hoverEffect>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-900">
                        {o.store?.name ?? 'ร้านค้า'}
                      </span>
                      <Badge
                        variant={o.status === 'cancelled' ? 'danger' : 'forest'}
                        size="sm"
                      >
                        {ORDER_STATUS_LABELS[o.status as OrderStatus]}
                      </Badge>
                    </div>
                    <p className="text-xs text-neutral-500">
                      {o.item_count} รายการ · ฿{Number(o.total_amount).toLocaleString()} ·{' '}
                      {formatDate(o.created_at)}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-neutral-400" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
