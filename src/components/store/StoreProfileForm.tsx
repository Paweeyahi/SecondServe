'use client';

import React, { useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { updateStoreProfile } from '@/lib/actions/store';
import type { StoreRow } from '@/lib/queries/store';

export function StoreProfileForm({ store }: { store: StoreRow }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSaved(false);

    const result = await updateStoreProfile(null, new FormData(e.currentTarget));
    setIsLoading(false);

    if (result?.error) setError(result.error);
    else setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="shadow-sm">
        <CardContent className="space-y-4 pt-6">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3.5 text-sm text-red-700 border border-red-200">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-2 rounded-xl bg-forest-50 p-3.5 text-sm text-forest-800 border border-forest-200">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-forest-700" />
              <span>บันทึกข้อมูลร้านค้าแล้ว</span>
            </div>
          )}

          <Input label="ชื่อร้านค้า" name="name" required defaultValue={store.name} />
          <Input label="ที่อยู่ร้านค้า" name="address" required defaultValue={store.address} />
          <Input label="เบอร์โทรศัพท์" name="phone" required defaultValue={store.phone} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="ละติจูด (latitude)"
              name="latitude"
              type="number"
              step="any"
              required
              defaultValue={store.latitude}
            />
            <Input
              label="ลองจิจูด (longitude)"
              name="longitude"
              type="number"
              step="any"
              required
              defaultValue={store.longitude}
            />
          </div>

          <Input
            label="ค่าจัดส่ง (บาท ต่อออเดอร์)"
            name="delivery_fee"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={store.delivery_fee}
            helperText="คิดกับลูกค้าเมื่อเลือกให้ไรเดอร์จัดส่ง (0 = ไม่มีค่าส่ง)"
          />
        </CardContent>

        <CardFooter>
          <Button type="submit" variant="primary" size="lg" isLoading={isLoading} className="w-full">
            บันทึกข้อมูลร้านค้า
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
