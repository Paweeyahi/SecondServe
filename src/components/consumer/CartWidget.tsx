'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, X, Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/context/CartContext';

export function CartWidget() {
  const { lines, count, itemsTotal, storeName, setQuantity, removeItem } = useCart();
  const savings = lines.reduce(
    (sum, l) => sum + Math.max(0, l.originalPrice - l.unitPrice) * l.quantity,
    0
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
        aria-label="ตะกร้าสินค้า"
      >
        <ShoppingCart className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-forest-700 px-1 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex justify-end">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <aside className="relative flex h-full w-full max-w-sm flex-col bg-white shadow-xl">
              <header className="flex items-center justify-between border-b border-neutral-200 p-4">
                <h2 className="font-bold text-neutral-900">
                  ตะกร้าสินค้า {storeName && `· ${storeName}`}
                </h2>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100"
                  aria-label="ปิด"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto p-4">
                {lines.length === 0 ? (
                  <p className="py-12 text-center text-sm text-neutral-500">
                    ตะกร้ายังว่างอยู่
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {lines.map((l) => (
                      <li key={l.productId} className="flex gap-3">
                        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                          <Image src={l.imageUrl} alt={l.name} fill className="object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-sm font-medium text-neutral-900">{l.name}</p>
                          <p className="text-xs text-forest-800 font-semibold">
                            ฿{l.unitPrice.toLocaleString()}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <button
                              onClick={() => setQuantity(l.productId, l.quantity - 1)}
                              className="rounded-md border border-neutral-300 p-1 text-neutral-600 hover:bg-neutral-50"
                              aria-label="ลด"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-6 text-center text-sm">{l.quantity}</span>
                            <button
                              onClick={() => setQuantity(l.productId, l.quantity + 1)}
                              disabled={l.quantity >= l.maxQuantity}
                              className="rounded-md border border-neutral-300 p-1 text-neutral-600 hover:bg-neutral-50 disabled:opacity-40"
                              aria-label="เพิ่ม"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => removeItem(l.productId)}
                              className="ml-auto rounded-md p-1 text-neutral-400 hover:text-red-600"
                              aria-label="ลบ"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {lines.length > 0 && (
                <footer className="space-y-3 border-t border-neutral-200 p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">รวมค่าสินค้า</span>
                    <span className="font-bold text-neutral-900">฿{itemsTotal.toLocaleString()}</span>
                  </div>
                  {savings > 0 && (
                    <div className="flex justify-between rounded-lg bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700">
                      <span>คุณประหยัดไป</span>
                      <span>฿{savings.toLocaleString()}</span>
                    </div>
                  )}
                  <Link href="/checkout" onClick={() => setOpen(false)} className="block">
                    <Button variant="primary" size="lg" className="w-full">
                      ดำเนินการสั่งซื้อ
                    </Button>
                  </Link>
                </footer>
              )}
            </aside>
          </div>,
          document.body
        )}
    </>
  );
}
