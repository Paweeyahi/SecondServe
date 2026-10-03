'use client';

import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASS = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-7 w-7' };

/** Read-only when `onChange` is omitted; an interactive 1-5 picker otherwise. */
export function StarRating({ value, onChange, size = 'md' }: StarRatingProps) {
  const interactive = Boolean(onChange);
  const sizeClass = SIZE_CLASS[size];

  return (
    <div
      className="flex items-center gap-0.5"
      role={interactive ? 'radiogroup' : undefined}
      aria-label="คะแนน"
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(value);
        return (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => onChange?.(star)}
            aria-label={`${star} ดาว`}
            className={interactive ? 'cursor-pointer' : 'cursor-default'}
          >
            <Star
              className={`${sizeClass} ${
                filled ? 'fill-amber-400 text-amber-400' : 'text-neutral-300'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
