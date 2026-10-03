import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { MapPin, Phone, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { StoreOrderActions } from '@/components/store/StoreOrderActions';
import { ORDER_STATUS_LABELS, type DeliveryType, type OrderStatus } from '@/types/order';
import { getCurrentStore } from '@/lib/queries/store';
import { getStoreOrderDetail } from '@/lib/queries/store-orders';

export const dynamic = 'force-dynamic';

const STATUS_VARIANT: Record<OrderStatus, BadgeProps['variant']> = {
  pending: 'warning',
  confirmed: 'forest',
  ready: 'forest',
  rider_assigned: 'rider',
  picked_up: 'rider',
  delivering: 'rider',
  completed: 'default',
  cancelled: 'danger',
};

export default async function StoreOrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const store = await getCurrentStore();
  if (!store) notFound();

  const order = await getStoreOrderDetail(store.id, params.id);
  if (!order) notFound();

  const status = order.status as OrderStatus;
  const itemsTotal = order.order_items.reduce(
    (s, i) => s + Number(i.unit_price) * i.quantity,
    0
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div>
          <p className="font-semibold text-neutral-900">
            ออเดอร์ #{order.id.slice(0, 8).toUpperCase()}
          </p>
          <p className="text-xs text-neutral-500">
            {order.delivery_type === 'delivery' ? 'จัดส่ง' : 'รับเองที่ร้าน'}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[status]} size="md">
          {ORDER_STATUS_LABELS[status]}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ข้อมูลลูกค้า</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-neutral-600">
          <p className="flex items-center gap-1.5">
            <User className="h-4 w-4" /> {order.consumer?.full_name ?? 'ลูกค้า'}
          </p>
          {order.consumer?.phone && (
            <p className="flex items-center gap-1.5">
              <Phone className="h-4 w-4" /> {order.consumer.phone}
            </p>
          )}
          {order.delivery_address && (
            <p className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> {order.delivery_address}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">รายการสินค้า</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {order.order_items.map((i) => (
            <div key={i.id} className="flex items-center gap-3">
              <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                {i.product?.image_url && (
                  <Image
                    src={i.product.image_url}
                    alt={i.product.name ?? ''}
                    fill
                    className="object-cover"
                  />
                )}
              </div>
              <span className="flex-1 text-sm text-neutral-700">
                {i.product?.name ?? 'สินค้า'} × {i.quantity}
              </span>
              <span className="text-sm font-medium text-neutral-900">
                ฿{(Number(i.unit_price) * i.quantity).toLocaleString()}
              </span>
            </div>
          ))}

          <div className="space-y-1 border-t border-neutral-200 pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-500">ค่าสินค้า</span>
              <span>฿{itemsTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">ค่าจัดส่ง</span>
              <span>฿{Number(order.delivery_fee).toLocaleString()}</span>
            </div>
            <div className="flex justify-between pt-1 text-base font-bold text-neutral-900">
              <span>รวมทั้งหมด</span>
              <span>฿{Number(order.total_amount).toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <StoreOrderActions
            orderId={order.id}
            status={status}
            deliveryType={order.delivery_type as DeliveryType}
          />
        </CardContent>
      </Card>

      <Link href="/dashboard/store/orders">
        <Button variant="outline" className="w-full">
          กลับไปหน้าออเดอร์ทั้งหมด
        </Button>
      </Link>
    </div>
  );
}
