'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Power, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { setShiftStatus } from '@/lib/actions/deliveries';
import type { RiderStatus } from '@/types/rider';

export function ShiftToggle({ status }: { status: RiderStatus }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    const next = status === 'available' ? 'offline' : 'available';
    startTransition(async () => {
      const result = await setShiftStatus(next);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  if (status === 'busy') {
    return <Badge variant="warning" size="md">กำลังจัดส่งงานอยู่</Badge>;
  }

  const online = status === 'available';

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant={online ? 'danger' : 'primary'}
        isLoading={isPending}
        leftIcon={online ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
        onClick={toggle}
      >
        {online ? 'ปิดรับงาน' : 'เปิดรับงาน'}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
