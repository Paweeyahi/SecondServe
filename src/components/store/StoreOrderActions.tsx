'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import {
  confirmOrder,
  markReady,
  completePickup,
  cancelOrder,
  type OrderActionResult,
} from '@/lib/actions/orders';
import type { DeliveryType, OrderStatus } from '@/types/order';

export function StoreOrderActions({
  orderId,
  status,
  deliveryType,
  className = 'pt-2',
}: {
  orderId: string;
  status: OrderStatus;
  deliveryType: DeliveryType;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  function run(action: (id: string) => Promise<OrderActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action(orderId);
      if (result.error) setError(result.error);
      else {
        setConfirmingCancel(false);
        router.refresh();
      }
    });
  }

  const canCancel = status === 'pending' || status === 'confirmed' || status === 'ready';

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {status === 'pending' && (
        <Button size="sm" variant="primary" isLoading={isPending} onClick={() => run(confirmOrder)}>
          ยืนยันออเดอร์
        </Button>
      )}
      {status === 'confirmed' && (
        <Button size="sm" variant="primary" isLoading={isPending} onClick={() => run(markReady)}>
          เตรียมสินค้าเสร็จแล้ว
        </Button>
      )}
      {status === 'ready' && deliveryType === 'pickup' && (
        <Button size="sm" variant="primary" isLoading={isPending} onClick={() => run(completePickup)}>
          ลูกค้ารับสินค้าแล้ว
        </Button>
      )}
      {status === 'ready' && deliveryType === 'delivery' && (
        <span className="text-xs text-neutral-500">รอไรเดอร์รับงาน</span>
      )}

      {canCancel && !confirmingCancel && (
        <Button
          size="sm"
          variant="ghost"
          className="text-neutral-500 hover:text-red-600"
          onClick={() => setConfirmingCancel(true)}
        >
          ยกเลิกออเดอร์
        </Button>
      )}
      {canCancel && confirmingCancel && (
        <>
          <span className="text-xs text-neutral-600">ยกเลิกออเดอร์นี้?</span>
          <Button size="sm" variant="danger" isLoading={isPending} onClick={() => run(cancelOrder)}>
            ยืนยันยกเลิก
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmingCancel(false)}>
            ปิด
          </Button>
        </>
      )}

      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}
