import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Leaf, MapPin, Phone, Store } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StarRating } from '@/components/shared/StarRating';
import { ReviewForm } from '@/components/consumer/ReviewForm';
import { getOrderDetail } from '@/lib/queries/orders';
import { getReviewsForOrder } from '@/lib/queries/reviews';
import { OrderStatusPanel } from '@/components/consumer/OrderStatusPanel';
import type { DeliveryType, OrderStatus } from '@/types/order';

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // Set by CheckoutClient right after a successful order.
  const justPlaced = searchParams.placed === '1';
  const order = await getOrderDetail(params.id);
  if (!order) notFound();

  const reviews =
    order.status === 'completed'
      ? await getReviewsForOrder(order.id)
      : { store: null, rider: null };
  const hasRider = order.delivery_type === 'delivery' && order.rider_id !== null;

  const itemsTotal = order.order_items.reduce(
    (s, i) => s + Number(i.unit_price) * i.quantity,
    0
  );
  const pieces = order.order_items.reduce((s, i) => s + i.quantity, 0);
  const saved = order.order_items.reduce(
    (s, i) =>
      s + Math.max(0, Number(i.product?.original_price ?? i.unit_price) - Number(i.unit_price)) * i.quantity,
    0
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      {justPlaced && (
        <div className="relative mb-4 overflow-hidden rounded-2xl bg-gradient-to-br from-forest-900 via-forest-800 to-forest-700 p-5 text-white shadow-sm">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-leaf-500/30 blur-2xl" aria-hidden="true" />
          <div className="relative flex items-start gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/15">
              <Leaf className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold">ขอบคุณที่ช่วยลดขยะอาหาร!</p>
              <p className="mt-0.5 text-sm text-forest-100">
                ออเดอร์นี้ช่วยให้อาหาร {pieces} ชิ้นไม่ถูกทิ้ง
                {saved > 0 && <> และคุณประหยัดไป <span className="font-semibold text-white">฿{saved.toLocaleString()}</span></>}
              </p>
              <Link href="/account" className="mt-2 inline-block text-xs font-medium text-white underline">
                ดูผลลัพธ์รวมของคุณ
              </Link>
            </div>
          </div>
        </div>
      )}
      <OrderStatusPanel
        orderId={order.id}
        orderCode={order.id.slice(0, 8).toUpperCase()}
        initialStatus={order.status as OrderStatus}
        deliveryType={order.delivery_type as DeliveryType}
      />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">
            <span className="flex items-center gap-2">
              <Store className="h-4 w-4" /> {order.store?.name ?? 'ร้านค้า'}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-neutral-600">
          {order.store?.address && (
            <p className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> {order.store.address}
            </p>
          )}
          {order.store?.phone && (
            <p className="flex items-center gap-1.5">
              <Phone className="h-4 w-4" /> {order.store.phone}
            </p>
          )}
          <p className="pt-1">
            การรับสินค้า:{' '}
            <span className="font-medium text-neutral-900">
              {order.delivery_type === 'delivery' ? 'ไรเดอร์จัดส่ง' : 'รับเองที่ร้าน'}
            </span>
          </p>
          {order.delivery_address && (
            <p>ที่อยู่จัดส่ง: {order.delivery_address}</p>
          )}
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">รายการสินค้า</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {order.order_items.map((i) => (
            <div key={i.id} className="flex items-center gap-3">
              <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                {i.product?.image_url && (
                  <Image src={i.product.image_url} alt={i.product.name ?? ''} fill className="object-cover" />
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

      {order.status === 'completed' && (
        <div className="mb-4 space-y-4">
          {reviews.store ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">รีวิวร้านค้าของคุณ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <StarRating value={reviews.store.rating} />
                {reviews.store.comment && (
                  <p className="text-sm text-neutral-600">{reviews.store.comment}</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <ReviewForm orderId={order.id} target="store" label="ให้คะแนนร้านนี้" />
          )}

          {hasRider &&
            (reviews.rider ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">รีวิวไรเดอร์ของคุณ</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <StarRating value={reviews.rider.rating} />
                  {reviews.rider.comment && (
                    <p className="text-sm text-neutral-600">{reviews.rider.comment}</p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <ReviewForm orderId={order.id} target="rider" label="ให้คะแนนไรเดอร์ที่จัดส่ง" />
            ))}
        </div>
      )}

      <Link href="/orders">
        <Button variant="outline" className="w-full">
          ดูออเดอร์ทั้งหมด
        </Button>
      </Link>
    </div>
  );
}
