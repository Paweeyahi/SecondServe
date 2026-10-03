'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Check, LogIn, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCart, type AddItemInput } from '@/context/CartContext';

export function AddToCartButton(
  props: AddItemInput & { soldOut?: boolean; canOrder?: boolean }
) {
  const { soldOut, canOrder = false, ...item } = props;
  const { addItem } = useCart();
  const pathname = usePathname();
  const [justAdded, setJustAdded] = useState(false);

  if (soldOut || item.maxQuantity <= 0) {
    return (
      <Button variant="outline" size="sm" disabled className="w-full">
        สินค้าหมด
      </Button>
    );
  }

  if (!canOrder) {
    return (
      <Link href={`/login?next=${encodeURIComponent(pathname || '/products')}`} className="block">
        <Button variant="outline" size="sm" className="w-full" leftIcon={<LogIn className="h-4 w-4" />}>
          เข้าสู่ระบบเพื่อสั่งซื้อ
        </Button>
      </Link>
    );
  }

  function handleAdd() {
    const result = addItem(item);
    if (result === 'different_store') {
      const ok = window.confirm(
        'ตะกร้าของคุณมีสินค้าจากร้านอื่นอยู่ (1 ออเดอร์ซื้อได้จากร้านเดียว) ต้องการล้างตะกร้าเดิมแล้วเพิ่มสินค้านี้ไหม?'
      );
      if (ok) addItem(item, { replaceStore: true });
      else return;
    }
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  }

  return (
    <Button
      variant={justAdded ? 'secondary' : 'primary'}
      size="sm"
      className="w-full"
      leftIcon={justAdded ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      onClick={handleAdd}
    >
      {justAdded ? 'เพิ่มลงตะกร้าแล้ว' : 'ใส่ตะกร้า'}
    </Button>
  );
}
