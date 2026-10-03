'use client';

import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, LocateFixed, MapPinOff } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { updateStoreProfile } from '@/lib/actions/store';
import type { StoreRow } from '@/lib/queries/store';

const DEFAULT_COORDS = { lat: 13.7563, lng: 100.5018 };

export function StoreProfileForm({ store }: { store: StoreRow }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [latitude, setLatitude] = useState(String(store.latitude));
  const [longitude, setLongitude] = useState(String(store.longitude));
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // handle_new_user() gives every new store this Bangkok-centre placeholder;
  // "ร้านใกล้ฉัน" distance sorting is meaningless until it is replaced.
  const isPlaceholder =
    Number(latitude) === DEFAULT_COORDS.lat && Number(longitude) === DEFAULT_COORDS.lng;
  const coordsValid =
    latitude !== '' && longitude !== '' && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));

  function fillCurrentLocation() {
    setLocationError(null);
    if (!('geolocation' in navigator)) {
      setLocationError('เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
      },
      () => {
        setLocating(false);
        setLocationError('ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง กรุณาเปิดสิทธิ์ตำแหน่งในเบราว์เซอร์ หรือกรอกพิกัดเอง');
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }
    );
  }

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

          <div className="space-y-3 rounded-xl border border-forest-100 bg-forest-50/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-neutral-800">ตำแหน่งร้าน</p>
                <p className="text-xs text-neutral-500">ใช้เรียงผลลัพธ์ "ร้านใกล้ฉัน" ให้ลูกค้า</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                isLoading={locating}
                leftIcon={<LocateFixed className="h-4 w-4" />}
                onClick={fillCurrentLocation}
              >
                ใช้ตำแหน่งปัจจุบัน
              </Button>
            </div>

            {isPlaceholder && (
              <p className="flex items-start gap-1.5 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-800">
                <MapPinOff className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                ยังเป็นพิกัดเริ่มต้น (ใจกลางกรุงเทพฯ) ไม่ใช่ที่ตั้งจริงของร้าน กด &ldquo;ใช้ตำแหน่งปัจจุบัน&rdquo;
                ขณะอยู่ที่ร้าน แล้วกดบันทึก
              </p>
            )}
            {locationError && <p className="text-xs text-red-600">{locationError}</p>}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="ละติจูด (latitude)"
                name="latitude"
                type="number"
                step="any"
                required
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
              />
              <Input
                label="ลองจิจูด (longitude)"
                name="longitude"
                type="number"
                step="any"
                required
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
              />
            </div>

            {coordsValid && (
              <a
                href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-forest-800 hover:underline"
              >
                ตรวจสอบตำแหน่งบน Google Maps <ExternalLink className="h-3 w-3" />
              </a>
            )}
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
