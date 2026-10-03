'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { AlertCircle, ImagePlus, Package } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_KEYS } from '@/types/product';
import { createProduct, updateProduct } from '@/lib/actions/products';
import type { ProductRow } from '@/lib/queries/store';

/** ISO timestamp -> value for <input type="datetime-local"> in local time. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

interface ProductFormProps {
  mode: 'create' | 'edit';
  product?: ProductRow;
}

export function ProductForm({ mode, product }: ProductFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(product?.image_url ?? null);

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    try {
      const result =
        mode === 'create'
          ? await createProduct(null, formData)
          : await updateProduct(product!.id, null, formData);

      if (result?.error) setError(result.error);
    } catch (err: unknown) {
      if ((err as Error)?.message?.includes('NEXT_REDIRECT')) throw err;
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <Card className="shadow-sm">
        <CardContent className="space-y-4 pt-6">
          {mode === 'edit' && (
            <input type="hidden" name="expected_quantity" value={product?.quantity ?? 0} />
          )}
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3.5 text-sm text-red-700 border border-red-200">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Image */}
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-neutral-700">
              รูปสินค้า {mode === 'edit' && '(อัปโหลดใหม่เพื่อเปลี่ยน)'}
            </span>
            <div className="flex items-center gap-4">
              <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
                {preview ? (
                  <Image src={preview} alt="ตัวอย่างรูปสินค้า" fill className="object-cover" unoptimized />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-neutral-300">
                    <Package className="h-8 w-8" />
                  </div>
                )}
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50">
                <ImagePlus className="h-4 w-4" />
                เลือกรูป
                <input
                  type="file"
                  name="image"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  required={mode === 'create'}
                  onChange={onPickImage}
                />
              </label>
            </div>
            <p className="text-xs text-neutral-500">JPG, PNG หรือ WebP ขนาดไม่เกิน 5MB</p>
          </div>

          <Input
            label="ชื่อสินค้า"
            name="name"
            required
            defaultValue={product?.name}
            placeholder="เช่น ขนมปังโฮลวีท"
          />

          <div className="space-y-1.5">
            <label htmlFor="category" className="block text-sm font-medium text-neutral-700">
              หมวดหมู่
            </label>
            <select
              id="category"
              name="category"
              required
              defaultValue={product?.category ?? ''}
              className="block w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/20"
            >
              <option value="" disabled>
                เลือกหมวดหมู่
              </option>
              {PRODUCT_CATEGORY_KEYS.map((key) => (
                <option key={key} value={key}>
                  {PRODUCT_CATEGORIES[key]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="ราคาปกติ (บาท)"
              name="original_price"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={product?.original_price}
            />
            <Input
              label="ราคาลด (บาท)"
              name="discount_price"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={product?.discount_price}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="จำนวนคงเหลือ"
              name="quantity"
              type="number"
              step="1"
              min="0"
              required
              defaultValue={product?.quantity ?? 0}
            />
            <Input
              label="วันหมดอายุ"
              name="expiry_date"
              type="datetime-local"
              required
              defaultValue={product ? toLocalInput(product.expiry_date) : undefined}
            />
          </div>
        </CardContent>

        <CardFooter className="flex gap-3">
          <Button type="submit" variant="primary" size="lg" isLoading={isLoading} className="flex-1">
            {mode === 'create' ? 'เพิ่มสินค้า' : 'บันทึกการแก้ไข'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => router.push('/dashboard/store/products')}
          >
            ยกเลิก
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
