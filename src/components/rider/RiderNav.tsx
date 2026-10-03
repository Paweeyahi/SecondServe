'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ListChecks, PackageCheck } from 'lucide-react';

const TABS = [
  { href: '/dashboard/rider', label: 'ภาพรวม', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/rider/jobs', label: 'งานจัดส่ง', icon: ListChecks, exact: false },
  { href: '/dashboard/rider/history', label: 'ประวัติการจัดส่ง', icon: PackageCheck, exact: false },
];

export function RiderNav() {
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
