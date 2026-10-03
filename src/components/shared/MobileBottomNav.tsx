'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HeartHandshake, Home, LogIn, Package, Search, UserRound } from 'lucide-react';
import type { UserRole } from '@/types/roles';

/**
 * Thumb-reachable bottom bar on phones, for shoppers and logged-out
 * visitors. Store / rider / admin accounts use their dashboard tabs instead.
 * Rendered outside the Navbar <header> on purpose: its backdrop-blur would
 * otherwise become the containing block for this position:fixed bar.
 */
export function MobileBottomNav({ role }: { role: UserRole | null }) {
  const pathname = usePathname();
  if (role && role !== 'consumer') return null;

  const items = [
    { href: '/', label: 'หน้าแรก', icon: Home, exact: true },
    { href: '/products', label: 'ค้นหา', icon: Search, exact: false },
    { href: '/shares', label: 'แบ่งปัน', icon: HeartHandshake, exact: false },
    ...(role === 'consumer'
      ? [
          { href: '/orders', label: 'ออเดอร์', icon: Package, exact: false },
          { href: '/account', label: 'บัญชี', icon: UserRound, exact: false },
        ]
      : [{ href: '/login', label: 'เข้าสู่ระบบ', icon: LogIn, exact: false }]),
  ];

  return (
    <nav
      id="mobile-bottom-nav"
      aria-label="เมนูหลัก"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-forest-100 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(20,83,45,0.08)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-md">
        {items.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                  active ? 'text-forest-800' : 'text-neutral-500 hover:text-forest-800'
                }`}
              >
                <span
                  className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                    active ? 'bg-forest-100' : ''
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
