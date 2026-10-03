'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { deleteProduct } from '@/lib/actions/products';

export function DeleteProductButton({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    startTransition(async () => {
      const result = await deleteProduct(productId);
      if (result?.error) {
        setError(result.error);
        setConfirming(false);
      } else {
        router.refresh();
      }
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-600">ลบ “{productName}”?</span>
        <Button variant="danger" size="sm" isLoading={isPending} onClick={onDelete}>
          ลบ
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          ยกเลิก
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="text-neutral-500 hover:text-red-600"
        leftIcon={<Trash2 className="h-4 w-4" />}
        onClick={() => setConfirming(true)}
      >
        ลบ
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
