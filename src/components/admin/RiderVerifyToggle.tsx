'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { setRiderVerified } from '@/lib/actions/admin';

export function RiderVerifyToggle({
  riderId,
  verified,
}: {
  riderId: string;
  verified: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setRiderVerified(riderId, !verified);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        size="sm"
        variant={verified ? 'outline' : 'primary'}
        isLoading={isPending}
        onClick={toggle}
      >
        {verified ? 'ยกเลิกยืนยัน' : 'ยืนยันไรเดอร์'}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
