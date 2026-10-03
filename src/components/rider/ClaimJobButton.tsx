'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { claimJob } from '@/lib/actions/deliveries';

export function ClaimJobButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClaim() {
    setError(null);
    startTransition(async () => {
      const result = await claimJob(orderId);
      if (result.error) setError(result.error);
      else router.push(`/dashboard/rider/jobs/${orderId}`);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="primary" isLoading={isPending} onClick={onClaim}>
        รับงานนี้
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
