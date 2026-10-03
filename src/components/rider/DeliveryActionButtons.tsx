'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import {
  markPickedUp,
  markDelivering,
  markDelivered,
  type DeliveryActionResult,
} from '@/lib/actions/deliveries';
import type { OrderStatus } from '@/types/order';

export function DeliveryActionButtons({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: (id: string) => Promise<DeliveryActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action(orderId);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === 'rider_assigned' && (
          <Button isLoading={isPending} onClick={() => run(markPickedUp)}>
            รับสินค้าจากร้านแล้ว
          </Button>
        )}
        {status === 'picked_up' && (
          <Button isLoading={isPending} onClick={() => run(markDelivering)}>
            เริ่มจัดส่ง
          </Button>
        )}
        {status === 'delivering' && (
          <Button isLoading={isPending} onClick={() => run(markDelivered)}>
            จัดส่งสำเร็จ
          </Button>
        )}
        {status === 'completed' && (
          <span className="text-sm text-neutral-500">งานนี้เสร็จสิ้นแล้ว</span>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
