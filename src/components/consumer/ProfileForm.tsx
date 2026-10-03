'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { updateMyProfile } from '@/lib/actions/profile';

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSaved(false);

    const result = await updateMyProfile(new FormData(e.currentTarget));
    setIsLoading(false);

    if (result.error) setError(result.error);
    else {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="shadow-sm">
        <CardContent className="space-y-4 pt-6">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-2 rounded-xl border border-forest-200 bg-forest-50 p-3.5 text-sm text-forest-800">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-forest-700" />
              <span>บันทึกข้อมูลแล้ว</span>
            </div>
          )}

          <Input
            id="full_name"
            label="ชื่อ-นามสกุล"
            name="full_name"
            required
            maxLength={120}
            defaultValue={fullName}
            helperText="ในรีวิวจะแสดงเป็นชื่อย่อ เช่น “สมใจ บ.”"
          />
          <Input
            id="phone"
            label="เบอร์โทรศัพท์"
            name="phone"
            required
            inputMode="numeric"
            maxLength={10}
            defaultValue={phone}
            helperText="ร้านค้าใช้ติดต่อเรื่องออเดอร์และการรับของบริจาค"
          />
        </CardContent>
        <CardFooter className="justify-end pt-4">
          <Button type="submit" variant="primary" isLoading={isLoading}>
            บันทึก
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
