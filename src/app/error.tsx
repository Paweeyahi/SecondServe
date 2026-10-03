'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h1 className="text-xl font-bold text-neutral-900">เกิดข้อผิดพลาดบางอย่าง</h1>
      <p className="text-sm text-neutral-500">
        ระบบโหลดหน้านี้ไม่สำเร็จ ลองใหม่อีกครั้ง หากยังไม่ได้ กรุณากลับหน้าแรกแล้วเริ่มใหม่
      </p>
      {error.digest && <p className="font-mono text-xs text-neutral-400">รหัสอ้างอิง: {error.digest}</p>}
      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <Button variant="primary" onClick={reset}>
          ลองใหม่
        </Button>
        <Link href="/">
          <Button variant="outline">กลับหน้าแรก</Button>
        </Link>
      </div>
    </div>
  );
}
