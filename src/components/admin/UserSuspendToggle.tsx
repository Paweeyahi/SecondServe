'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { setUserSuspended } from '@/lib/actions/admin';

export function UserSuspendToggle({
  userId,
  suspended,
}: {
  userId: string;
  suspended: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setUserSuspended(userId, !suspended);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        size="sm"
        variant={suspended ? 'outline' : 'danger'}
        isLoading={isPending}
        onClick={toggle}
      >
        {suspended ? 'ยกเลิกระงับ' : 'ระงับบัญชี'}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
