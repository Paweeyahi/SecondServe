'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import {
  cancelShareClaim,
  markShareCollected,
  type DonationActionResult,
} from '@/lib/actions/donations';

/**
 * Buttons for a `reserved` donation claim. The claimer can only cancel; the
 * donating store can confirm hand-over or cancel (e.g. a no-show).
 */
export function ShareClaimActions({
  claimId,
  mode,
}: {
  claimId: string;
  mode: 'consumer' | 'store';
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  function run(action: (id: string) => Promise<DonationActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action(claimId);
      if (result.error) setError(result.error);
      else {
        setConfirmingCancel(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {mode === 'store' && !confirmingCancel && (
          <Button
            size="sm"
            variant="primary"
            isLoading={isPending}
            onClick={() => run(markShareCollected)}
          >
            รับของแล้ว
          </Button>
        )}
        {confirmingCancel ? (
          <>
            <span className="text-xs text-neutral-600">ยืนยันยกเลิกการจอง?</span>
            <Button
              size="sm"
              variant="danger"
              isLoading={isPending}
              onClick={() => run(cancelShareClaim)}
            >
              ยืนยัน
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmingCancel(false)}>
              ไม่ใช่
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="text-neutral-500 hover:text-red-600"
            disabled={isPending}
            onClick={() => setConfirmingCancel(true)}
          >
            ยกเลิกการจอง
          </Button>
        )}
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
