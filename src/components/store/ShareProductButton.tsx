'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { HeartHandshake } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { shareProduct } from '@/lib/actions/donations';

export function ShareProductButton({
  productId,
  productName,
  quantity,
  foundations,
}: {
  productId: string;
  productName: string;
  quantity: number;
  foundations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pickupNote, setPickupNote] = useState('');
  const [recipient, setRecipient] = useState<'community' | 'foundation'>('community');
  const [foundationId, setFoundationId] = useState(foundations[0]?.id ?? '');
  const toFoundation = recipient === 'foundation';
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onShare() {
    setError(null);
    startTransition(async () => {
      const result = await shareProduct(
        productId,
        pickupNote,
        toFoundation ? foundationId : null
      );
      if (result.error) {
        setError(result.error);
      } else {
        setConfirming(false);
        router.refresh();
      }
    });
  }

  if (confirming) {
    return (
      <div className="w-full basis-full space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
        <p className="text-xs text-neutral-700">
          ส่งต่อ “{productName}” ทั้งหมด {quantity} ชิ้น สินค้าจะถูกนำออกจากหน้าขาย
        </p>

        <fieldset className="space-y-1.5">
          <legend className="mb-1 text-xs font-medium text-neutral-700">ส่งต่อให้</legend>
          <label className="flex items-start gap-2 text-xs text-neutral-700">
            <input
              type="radio"
              name={`recipient-${productId}`}
              className="mt-0.5 accent-forest-700"
              checked={!toFoundation}
              onChange={() => setRecipient('community')}
            />
            <span>
              <span className="font-medium">ทุกคนในชุมชน</span> — ผู้ใช้กดขอรับได้คนละไม่เกิน 5 ชิ้น
            </span>
          </label>
          <label
            className={`flex items-start gap-2 text-xs ${foundations.length === 0 ? 'text-neutral-400' : 'text-neutral-700'}`}
          >
            <input
              type="radio"
              name={`recipient-${productId}`}
              className="mt-0.5 accent-forest-700"
              checked={toFoundation}
              disabled={foundations.length === 0}
              onChange={() => setRecipient('foundation')}
            />
            <span>
              <span className="font-medium">มูลนิธิ</span> — มอบทั้งล็อตให้มูลนิธิที่เลือก
              {foundations.length === 0 && ' (ยังไม่มีมูลนิธิในระบบ)'}
            </span>
          </label>
          {toFoundation && (
            <select
              value={foundationId}
              onChange={(e) => setFoundationId(e.target.value)}
              aria-label="เลือกมูลนิธิ"
              className="block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/20"
            >
              {foundations.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
        </fieldset>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-neutral-700">
            {toFoundation ? 'หมายเหตุถึงมูลนิธิ (ไม่บังคับ)' : 'หมายเหตุการรับของ (ไม่บังคับ)'}
          </span>
          <textarea
            value={pickupNote}
            onChange={(e) => setPickupNote(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder={
              toFoundation
                ? 'เช่น จะนำไปส่งวันเสาร์ช่วงเช้า'
                : 'เช่น รับได้ที่หน้าร้าน 17:00–20:00 แจ้งชื่อกับพนักงาน'
            }
            className="block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/20"
          />
          <span className="block text-right text-[11px] text-neutral-400">
            {pickupNote.length}/200
          </span>
        </label>
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            ยกเลิก
          </Button>
          <Button variant="primary" size="sm" isLoading={isPending} onClick={onShare}>
            ยืนยันแชร์
          </Button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="text-emerald-700 hover:text-emerald-800"
        leftIcon={<HeartHandshake className="h-4 w-4" />}
        onClick={() => setConfirming(true)}
      >
        แชร์ให้ชุมชน
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
