'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { saveFoundation } from '@/lib/actions/admin';
import type { FoundationRow } from '@/lib/queries/foundations';

/**
 * Create (no `foundation`) or edit form for a donation-recipient foundation.
 * Starts collapsed behind a button; collapses again after a successful save.
 */
export function FoundationForm({ foundation }: { foundation?: FoundationRow }) {
  const router = useRouter();
  const isEdit = !!foundation;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(foundation?.name ?? '');
  const [description, setDescription] = useState(foundation?.description ?? '');
  const [address, setAddress] = useState(foundation?.address ?? '');
  const [phone, setPhone] = useState(foundation?.phone ?? '');
  const [active, setActive] = useState(foundation?.active ?? true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveFoundation({
        id: foundation?.id ?? null,
        name,
        description,
        address,
        phone,
        active,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      if (!isEdit) {
        setName('');
        setDescription('');
        setAddress('');
        setPhone('');
        setActive(true);
      }
      router.refresh();
    });
  }

  if (!open) {
    return isEdit ? (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        แก้ไข
      </Button>
    ) : (
      <Button
        size="sm"
        variant="primary"
        leftIcon={<Plus className="h-4 w-4" />}
        onClick={() => setOpen(true)}
      >
        เพิ่มมูลนิธิ
      </Button>
    );
  }

  const idPrefix = foundation?.id ?? 'new';

  return (
    <form
      onSubmit={onSubmit}
      className="w-full basis-full space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
    >
      <Input
        id={`${idPrefix}-name`}
        label="ชื่อมูลนิธิ"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={120}
        required
      />
      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-desc`} className="block text-sm font-medium text-neutral-700">
          รายละเอียด (ไม่บังคับ)
        </label>
        <textarea
          id={`${idPrefix}-desc`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={2}
          className="block w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/20"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          id={`${idPrefix}-address`}
          label="ที่อยู่ (ไม่บังคับ)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          maxLength={300}
        />
        <Input
          id={`${idPrefix}-phone`}
          label="เบอร์โทร (ไม่บังคับ)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          maxLength={20}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="accent-forest-700"
        />
        เปิดรับบริจาค (ร้านค้าเลือกมูลนิธินี้ได้)
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          ยกเลิก
        </Button>
        <Button type="submit" size="sm" variant="primary" isLoading={isPending}>
          บันทึก
        </Button>
      </div>
    </form>
  );
}
