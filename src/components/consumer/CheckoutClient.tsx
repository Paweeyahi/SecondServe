'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Bike, ShoppingBag, Store } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/context/CartContext';
import {
  createOrder,
  getCheckoutStoreInfo,
  type CheckoutStoreInfo,
} from '@/lib/actions/orders';

type DeliveryType = 'pickup' | 'delivery';

export function CheckoutClient() {
  const router = useRouter();
  const { storeId, storeName, lines, itemsTotal, clear, removeItem } = useCart();

  const [store, setStore] = useState<CheckoutStoreInfo | null>(null);
  const [loadingStore, setLoadingStore] = useState(true);
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('pickup');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [outOfStockIds, setOutOfStockIds] = useState<string[]>([]);

  useEffect(() => {
    if (!storeId) {
      setLoadingStore(false);
      return;
    }
    getCheckoutStoreInfo(storeId)
      .then(setStore)
      .finally(() => setLoadingStore(false));
  }, [storeId]);

  if (lines.length === 0) {
    return (
      <EmptyState message="ตะกร้าของคุณว่างเปล่า" />
    );
  }

  if (loadingStore) {
    return <div className="h-40 animate-pulse rounded-2xl bg-neutral-100" />;
  }

  if (!store || !store.available) {
    return <EmptyState message="ร้านค้านี้ไม่พร้อมให้บริการแล้ว กรุณาล้างตะกร้าและเลือกร้านอื่น" />;
  }

  const deliveryFee = deliveryType === 'delivery' ? store.deliveryFee : 0;
  const total = itemsTotal + deliveryFee;
  const savings = lines.reduce(
    (sum, l) => sum + Math.max(0, l.originalPrice - l.unitPrice) * l.quantity,
    0
  );

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    const result = await createOrder({
      storeId: store!.id,
      deliveryType,
      deliveryAddress: address,
      items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
    });

    if (result.error) {
      setError(result.error);
      if (result.outOfStock?.length) setOutOfStockIds(result.outOfStock);
      setSubmitting(false);
      return;
    }

    clear();
    router.push(`/orders/${result.orderId}?placed=1`);
  }

  function handleRemoveOutOfStock(productId: string) {
    removeItem(productId);
    setOutOfStockIds((prev) => prev.filter((id) => id !== productId));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">รับสินค้าจาก {storeName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <button
              type="button"
              onClick={() => setDeliveryType('pickup')}
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left ${
                deliveryType === 'pickup'
                  ? 'border-forest-600 bg-forest-50/60 ring-2 ring-forest-600/20'
                  : 'border-neutral-200'
              }`}
            >
              <Store className="mt-0.5 h-5 w-5 text-forest-700" />
              <span>
                <span className="block text-sm font-semibold text-neutral-900">รับเองที่ร้าน</span>
                <span className="block text-xs text-neutral-500">{store.address} · ไม่มีค่าจัดส่ง</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDeliveryType('delivery')}
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left ${
                deliveryType === 'delivery'
                  ? 'border-forest-600 bg-forest-50/60 ring-2 ring-forest-600/20'
                  : 'border-neutral-200'
              }`}
            >
              <Bike className="mt-0.5 h-5 w-5 text-sky-700" />
              <span>
                <span className="block text-sm font-semibold text-neutral-900">ให้ไรเดอร์จัดส่ง</span>
                <span className="block text-xs text-neutral-500">
                  ค่าจัดส่ง ฿{store.deliveryFee.toLocaleString()}
                </span>
              </span>
            </button>

            {deliveryType === 'delivery' && (
              <div className="space-y-1.5">
                <label htmlFor="address" className="block text-sm font-medium text-neutral-700">
                  ที่อยู่จัดส่ง
                </label>
                <textarea
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  placeholder="บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด"
                  className="block w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/20"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">รายการสินค้า</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-neutral-100">
            {lines.map((l) => {
              const isOutOfStock = outOfStockIds.includes(l.productId);
              return (
                <div
                  key={l.productId}
                  className={`flex items-center justify-between gap-3 py-2 text-sm ${
                    isOutOfStock ? 'rounded-lg bg-red-50 px-2' : ''
                  }`}
                >
                  <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                    <Image
                      src={l.imageUrl}
                      alt={l.name}
                      fill
                      sizes="48px"
                      className={`object-cover ${isOutOfStock ? 'grayscale opacity-60' : ''}`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span
                      className={
                        isOutOfStock ? 'text-red-700 line-through' : 'text-neutral-700'
                      }
                    >
                      {l.name} × {l.quantity}
                    </span>
                    {isOutOfStock && (
                      <span className="block text-xs font-medium text-red-600">
                        สินค้านี้หมดสต็อกแล้ว
                      </span>
                    )}
                  </div>
                  {isOutOfStock ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-shrink-0"
                      onClick={() => handleRemoveOutOfStock(l.productId)}
                    >
                      ลบออก
                    </Button>
                  ) : (
                    <span className="flex-shrink-0 font-medium text-neutral-900">
                      ฿{(l.unitPrice * l.quantity).toLocaleString()}
                    </span>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle className="text-base">สรุปคำสั่งซื้อ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-2.5 text-red-700 border border-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-neutral-500">ค่าสินค้า</span>
            <span>฿{itemsTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">ค่าจัดส่ง</span>
            <span>฿{deliveryFee.toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-bold text-neutral-900">
            <span>รวมทั้งหมด</span>
            <span>฿{total.toLocaleString()}</span>
          </div>
          {savings > 0 && (
            <div className="flex justify-between rounded-lg bg-orange-50 px-3 py-2 font-semibold text-orange-700">
              <span>คุณประหยัดไป</span>
              <span>฿{savings.toLocaleString()}</span>
            </div>
          )}
          <p className="pt-1 text-xs text-neutral-500">ชำระเงินปลายทาง (เก็บเงินเมื่อรับสินค้า)</p>
          <Button
            variant="primary"
            size="lg"
            className="mt-2 w-full"
            isLoading={submitting}
            disabled={outOfStockIds.length > 0}
            onClick={handleSubmit}
          >
            ยืนยันคำสั่งซื้อ
          </Button>
          {outOfStockIds.length > 0 && (
            <p className="text-center text-xs text-red-600">
              กรุณาลบสินค้าที่หมดสต็อกออกจากตะกร้าก่อนสั่งซื้อต่อ
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
      <ShoppingBag className="h-10 w-10 text-neutral-300" />
      <p className="text-sm text-neutral-500">{message}</p>
      <Link href="/products">
        <Button variant="primary">เลือกซื้อสินค้า</Button>
      </Link>
    </div>
  );
}
