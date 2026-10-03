import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <div className="relative h-28 w-28 opacity-90">
        <Image src="/logoSS.png" alt="" fill sizes="112px" className="object-contain" />
      </div>
      <p className="text-5xl font-black text-forest-900">404</p>
      <h1 className="text-xl font-bold text-neutral-900">ไม่พบหน้าที่คุณต้องการ</h1>
      <p className="text-sm text-neutral-500">
        ลิงก์อาจไม่ถูกต้อง หรือสินค้า/ร้านค้านี้อาจไม่มีในระบบแล้ว
      </p>
      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <Link href="/">
          <Button variant="primary">กลับหน้าแรก</Button>
        </Link>
        <Link href="/products">
          <Button variant="outline">ค้นหาสินค้า</Button>
        </Link>
      </div>
    </div>
  );
}
