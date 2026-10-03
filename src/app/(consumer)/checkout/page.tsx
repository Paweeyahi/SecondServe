import { CheckoutClient } from '@/components/consumer/CheckoutClient';
import { PageHeader } from '@/components/ui/PageHeader';
import { ShoppingCart } from 'lucide-react';

export const metadata = { title: 'ชำระเงิน — SecondServe' };

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <PageHeader icon={ShoppingCart} title="ยืนยันคำสั่งซื้อ" subtitle="ตรวจสอบรายการและเลือกวิธีรับสินค้า" />
      </div>
      <CheckoutClient />
    </div>
  );
}
