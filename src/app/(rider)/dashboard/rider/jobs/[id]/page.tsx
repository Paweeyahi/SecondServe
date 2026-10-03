import Image from 'next/image';
import { notFound } from 'next/navigation';
import { MapPin, Phone, Store, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { DeliveryActionButtons } from '@/components/rider/DeliveryActionButtons';
import { ClaimJobButton } from '@/components/rider/ClaimJobButton';
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/types/order';
import { getCurrentRider, getRiderOrderDetail } from '@/lib/queries/rider';

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

export default async function RiderJobDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const rider = await getCurrentRider();
  if (!rider) notFound();

  const order = await getRiderOrderDetail(params.id);
  if (!order) notFound();

  const status = order.status as OrderStatus;
  const isMine = order.rider_id === rider.id;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <p className="font-semibold text-neutral-900">
          งาน #{order.id.slice(0, 8).toUpperCase()}
        </p>
        <Badge variant={STATUS_VARIANT[status]} size="md">
          {ORDER_STATUS_LABELS[status]}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">รับสินค้าจาก</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-neutral-600">
          <p className="flex items-center gap-1.5">
            <Store className="h-4 w-4" /> {order.store?.name ?? 'ร้านค้า'}
          </p>
          <p className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" /> {order.store?.address ?? '-'}
          </p>
          {order.store?.phone && (
            <p className="flex items-center gap-1.5">
              <Phone className="h-4 w-4" /> {order.store.phone}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">จัดส่งให้</CardTitle>
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
          <p className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" /> {order.delivery_address}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">รายการสินค้า ({order.order_items.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-neutral-700">
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
              <span>
                {i.product?.name ?? 'สินค้า'} × {i.quantity}
              </span>
            </div>
          ))}
          <p className="border-t border-neutral-100 pt-3 text-sm font-semibold text-neutral-900">
            ค่าจัดส่ง ฿{Number(order.delivery_fee).toLocaleString()}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          {isMine ? (
            <DeliveryActionButtons orderId={order.id} status={status} />
          ) : (
            <ClaimJobButton orderId={order.id} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
