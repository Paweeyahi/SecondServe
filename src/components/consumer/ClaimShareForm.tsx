'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, HandHeart, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { claimShare } from '@/lib/actions/donations';
import { MAX_CLAIM_QUANTITY } from '@/types/share';

export function ClaimShareForm({ shareId, remaining }: { shareId: string; remaining: number }) {
  const router = useRouter();
  const max = Math.min(MAX_CLAIM_QUANTITY, remaining);
  const [quantity, setQuantity] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function onClaim() {
    setError(null);
    startTransition(async () => {
      const result = await claimShare(shareId, quantity);
      if (result.error) {
        setError(result.error);
      } else {
        setDone(true);
        router.refresh();
      }
    });
  }

  if (done) {
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-forest-700">
        <CheckCircle2 className="h-4 w-4" />
        จองแล้ว — ดูรายละเอียดการรับที่{' '}
        <Link href="/claims" className="underline">
          ของที่ขอรับ
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-xl border border-neutral-300 bg-white">
          <button
            type="button"
            className="p-2 text-neutral-600 hover:text-neutral-900 disabled:opacity-40"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1 || isPending}
            aria-label="ลดจำนวน"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-8 text-center text-sm font-semibold" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            className="p-2 text-neutral-600 hover:text-neutral-900 disabled:opacity-40"
            onClick={() => setQuantity((q) => Math.min(max, q + 1))}
            disabled={quantity >= max || isPending}
            aria-label="เพิ่มจำนวน"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <Button
          size="sm"
          variant="primary"
          isLoading={isPending}
          leftIcon={<HandHeart className="h-4 w-4" />}
          onClick={onClaim}
        >
          ขอรับ
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
