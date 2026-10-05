'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { setCommissionRate } from '@/lib/actions/admin';

/** Admin control for the platform commission rate, entered as a percent. */
export function CommissionRateForm({ ratePercent }: { ratePercent: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(ratePercent));
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await setCommissionRate(Number(value));
      if (result.error) setMessage({ ok: false, text: result.error });
      else {
        setMessage({ ok: true, text: 'บันทึกแล้ว มีผลกับออเดอร์ใหม่ตั้งแต่นี้' });
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={save} className="space-y-2">
      <label htmlFor="commission-rate" className="text-xs font-medium text-neutral-600">
        อัตราค่าคอมมิชชัน
      </label>
      <div className="flex items-center gap-2">
        <div className="relative w-28">
          <input
            id="commission-rate"
            type="number"
            min={0}
            max={50}
            step={0.5}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 py-2 pl-3 pr-8 text-sm focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-200"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
            %
          </span>
        </div>
        <Button type="submit" size="sm" isLoading={isPending}>
          บันทึก
        </Button>
      </div>
      {message && (
        <p className={`text-xs ${message.ok ? 'text-forest-700' : 'text-red-600'}`}>{message.text}</p>
      )}
    </form>
  );
}
