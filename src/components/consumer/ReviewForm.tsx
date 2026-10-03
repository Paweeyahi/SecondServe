'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { StarRating } from '@/components/shared/StarRating';
import { Button } from '@/components/ui/Button';
import { submitReview } from '@/lib/actions/reviews';

export function ReviewForm({
  orderId,
  target,
  label,
}: {
  orderId: string;
  target: 'store' | 'rider';
  label: string;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (rating === 0) {
      setError('กรุณาให้คะแนนก่อนส่งรีวิว');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await submitReview({
        orderId,
        target,
        rating,
        comment: comment.trim() || undefined,
      });
      if (result.error) setError(result.error);
      else {
        setSubmitted(true);
        router.refresh();
      }
    });
  }

  if (submitted) {
    return (
      <div className="rounded-xl bg-forest-50 p-4 text-sm text-forest-800">
        ขอบคุณสำหรับรีวิว!
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 p-4">
      <p className="text-sm font-medium text-neutral-900">{label}</p>
      <StarRating value={rating} onChange={setRating} size="lg" />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="เล่าประสบการณ์ของคุณ (ไม่บังคับ)"
        className="block w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/20"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Button variant="primary" size="sm" isLoading={isPending} onClick={handleSubmit}>
        ส่งรีวิว
      </Button>
    </div>
  );
}
