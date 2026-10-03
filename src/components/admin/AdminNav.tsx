'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bike, Building2, LayoutDashboard, Store, Users } from 'lucide-react';

const TABS = [
  { href: '/dashboard/admin', label: 'ภาพรวม', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/admin/users', label: 'ผู้ใช้', icon: Users, exact: false },
  { href: '/dashboard/admin/stores', label: 'ร้านค้า', icon: Store, exact: false },
  { href: '/dashboard/admin/riders', label: 'ไรเดอร์', icon: Bike, exact: false },
  { href: '/dashboard/admin/foundations', label: 'มูลนิธิ', icon: Building2, exact: false },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto rounded-xl bg-forest-50 p-1 ring-1 ring-forest-100">
      {TABS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
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
          </Link>
        );
      })}
    </nav>
  );
}
