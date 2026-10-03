'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, HeartHandshake, LayoutDashboard, Package, Settings } from 'lucide-react';

const TABS = [
  { href: '/dashboard/store', label: 'ภาพรวม', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/store/products', label: 'สินค้า', icon: Package, exact: false },
  { href: '/dashboard/store/orders', label: 'ออเดอร์', icon: ClipboardList, exact: false },
  { href: '/dashboard/store/shares', label: 'แชร์ชุมชน', icon: HeartHandshake, exact: false },
  { href: '/dashboard/store/settings', label: 'ตั้งค่าร้าน', icon: Settings, exact: false },
];

export function StoreNav({
  pendingOrderCount = 0,
  reservedClaimCount = 0,
}: {
  pendingOrderCount?: number;
  reservedClaimCount?: number;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto rounded-xl bg-forest-50 p-1 ring-1 ring-forest-100">
      {TABS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        const badgeCount =
          href === '/dashboard/store/orders'
            ? pendingOrderCount
            : href === '/dashboard/store/shares'
              ? reservedClaimCount
              : 0;
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? 'bg-forest-800 text-white shadow-sm'
                : 'text-forest-900/70 hover:bg-white hover:text-forest-800'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {badgeCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                {badgeCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
