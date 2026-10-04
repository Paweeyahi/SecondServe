'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { StoreLogo } from '@/components/shared/StoreLogo';
import { removeStoreLogo, uploadStoreLogo } from '@/lib/actions/store';

export function StoreLogoForm({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.set('logo', file);
    startTransition(async () => {
      const result = await uploadStoreLogo(fd);
      if (result.error) setError(result.error);
      else router.refresh();
      if (inputRef.current) inputRef.current.value = '';
    });
  }

  function onRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeStoreLogo();
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4 p-5">
        <StoreLogo name={name} logoUrl={logoUrl} size="lg" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-neutral-800">โลโก้ร้าน</p>
          <p className="text-xs text-neutral-500">
            แสดงที่หน้าร้าน หน้าสินค้า และการ์ดสินค้า · JPG, PNG หรือ WebP ไม่เกิน 2MB · แนะนำรูปสี่เหลี่ยมจัตุรัส
          </p>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onPick}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            isLoading={isPending}
            leftIcon={<ImagePlus className="h-4 w-4" />}
            onClick={() => inputRef.current?.click()}
          >
            {logoUrl ? 'เปลี่ยนโลโก้' : 'อัปโหลดโลโก้'}
          </Button>
          {logoUrl && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPending}
              className="text-neutral-500 hover:text-red-600"
              leftIcon={<Trash2 className="h-4 w-4" />}
              onClick={onRemove}
            >
              ลบ
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
