'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { setStoreVerified } from '@/lib/actions/admin';

export function StoreVerifyToggle({
  storeId,
  verified,
}: {
  storeId: string;
  verified: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setStoreVerified(storeId, !verified);
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
        {verified ? 'ยกเลิกยืนยัน' : 'ยืนยันร้าน'}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
