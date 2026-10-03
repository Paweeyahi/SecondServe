'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { markFoundationDelivered } from '@/lib/actions/donations';

/** Store confirms a foundation-earmarked donation has been handed over. */
export function FoundationDeliveredButton({ shareId }: { shareId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await markFoundationDelivered(shareId);
      if (result.error) setError(result.error);
      else {
        setConfirming(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {confirming ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-xs text-neutral-600">ยืนยันว่าส่งมอบให้มูลนิธิแล้ว?</span>
          <Button size="sm" variant="primary" isLoading={isPending} onClick={onConfirm}>
            ยืนยัน
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            ไม่ใช่
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="primary" onClick={() => setConfirming(true)}>
          ส่งมอบแล้ว
        </Button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
