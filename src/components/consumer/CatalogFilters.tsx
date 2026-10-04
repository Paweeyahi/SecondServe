'use client';

import React, { useCallback, useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { LocateFixed, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_KEYS } from '@/types/product';

const EXP_OPTIONS = [
  { value: '', label: 'ทุกช่วงเวลา' },
  { value: 'today', label: 'หมดอายุใน 24 ชม.' },
  { value: '3days', label: 'ภายใน 3 วัน' },
  { value: 'week', label: 'ภายใน 7 วัน' },
];

const SORT_OPTIONS = [
  { value: 'expiry', label: 'ใกล้หมดอายุก่อน' },
  { value: 'price', label: 'ราคาต่ำ → สูง' },
  { value: 'newest', label: 'มาใหม่ล่าสุด' },
  { value: 'distance', label: 'ใกล้ฉันที่สุด' },
];

/**
 * Catalog filter controls. All state lives in the URL query string
 * (SKILL.md §4.1) — this component only reads and rewrites it.
 */
export function CatalogFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const sortingByDistance = searchParams.get('sort') === 'distance';

  const commit = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      // A different filter/sort means a different result set -- start over.
      params.delete('page');
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
        // Router Cache can otherwise reuse the previous RSC payload for this path
        router.refresh();
      });
    },
    [router, pathname, searchParams]
  );

  const setParam = (key: string, value: string) =>
    commit((params) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });

  /** Asks the browser for the visitor's location, then sorts by distance. */
  const sortByDistance = () => {
    setLocationError(null);
    if (!('geolocation' in navigator)) {
      setLocationError('เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        commit((params) => {
          params.set('sort', 'distance');
          // ~100 m precision is plenty for "nearest store" and keeps URLs less exact.
          params.set('lat', pos.coords.latitude.toFixed(3));
          params.set('lng', pos.coords.longitude.toFixed(3));
        });
      },
      () => {
        setLocating(false);
        setLocationError('ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง กรุณาเปิดสิทธิ์ตำแหน่งในเบราว์เซอร์');
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
    );
  };

  const changeSort = (v: string) => {
    if (v === 'distance') {
      sortByDistance();
      return;
    }
    commit((params) => {
      if (v === 'expiry') params.delete('sort');
      else params.set('sort', v);
      params.delete('lat');
      params.delete('lng');
    });
  };

  // Debounce the free-text search into the URL
  useEffect(() => {
    const current = searchParams.get('q') ?? '';
    if (q === current) return;
    const t = setTimeout(() => setParam('q', q), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const hasFilters =
    !!searchParams.get('q') ||
    !!searchParams.get('category') ||
    !!searchParams.get('exp') ||
    !!searchParams.get('minPrice') ||
    !!searchParams.get('maxPrice');

  return (
    <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <Input
        placeholder="ค้นหาชื่อสินค้า หรือชื่อร้าน"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        leftIcon={<Search className="h-4 w-4" />}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          label="หมวดหมู่"
          value={searchParams.get('category') ?? ''}
          onChange={(v) => setParam('category', v)}
          options={[
            { value: '', label: 'ทุกหมวดหมู่' },
            ...PRODUCT_CATEGORY_KEYS.map((k) => ({ value: k, label: PRODUCT_CATEGORIES[k] })),
          ]}
        />
        <Select
          label="ช่วงวันหมดอายุ"
          value={searchParams.get('exp') ?? ''}
          onChange={(v) => setParam('exp', v)}
          options={EXP_OPTIONS}
        />
        <Input
          label="ราคาต่ำสุด"
          type="number"
          min="0"
          defaultValue={searchParams.get('minPrice') ?? ''}
          onBlur={(e) => setParam('minPrice', e.target.value)}
        />
        <Input
          label="ราคาสูงสุด"
          type="number"
          min="0"
          defaultValue={searchParams.get('maxPrice') ?? ''}
          onBlur={(e) => setParam('maxPrice', e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
          <div className="w-full sm:w-56">
            <Select
              label="เรียงตาม"
              value={searchParams.get('sort') ?? 'expiry'}
              onChange={changeSort}
              options={SORT_OPTIONS}
            />
          </div>
          <Button
            variant={sortingByDistance ? 'primary' : 'outline'}
            isLoading={locating}
            leftIcon={<LocateFixed className="h-4 w-4" />}
            onClick={sortByDistance}
          >
            {sortingByDistance ? 'เรียงตามระยะทางแล้ว' : 'ร้านใกล้ฉัน'}
          </Button>
          {locationError && <p className="w-full text-xs text-red-600">{locationError}</p>}
        </div>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<X className="h-4 w-4" />}
            onClick={() => {
              setQ('');
              startTransition(() => {
                router.replace(pathname, { scroll: false });
                router.refresh();
              });
            }}
          >
            ล้างตัวกรอง
          </Button>
        )}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="w-full space-y-1.5">
      <label className="block text-sm font-medium text-neutral-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/20"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
