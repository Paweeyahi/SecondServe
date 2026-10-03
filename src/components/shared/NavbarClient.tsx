'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Menu,
  X,
  Store,
  Bike,
  ShieldCheck,
  LogOut,
  LogIn,
  UserPlus,
  User,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CartWidget } from '@/components/consumer/CartWidget';
import { signOut } from '@/lib/actions/auth';
import type { UserRole } from '@/types/roles';

interface NavbarClientProps {
  user: {
    id: string;
    email?: string;
  } | null;
  profile: {
    role: UserRole;
    full_name: string;
    phone: string;
  } | null;
}

export function NavbarClient({ user, profile }: NavbarClientProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const role = profile?.role;
  const showCart = role === 'consumer';

  const getRoleBadge = (r: UserRole) => {
    switch (r) {
      case 'store':
        return (
          <Badge variant="store" size="sm" className="gap-1">
            <Store className="h-3 w-3" /> ร้านค้า
          </Badge>
        );
      case 'rider':
        return (
          <Badge variant="rider" size="sm" className="gap-1">
            <Bike className="h-3 w-3" /> ไรเดอร์
          </Badge>
        );
      case 'admin':
        return (
          <Badge variant="admin" size="sm" className="gap-1">
            <ShieldCheck className="h-3 w-3" /> ผู้ดูแลระบบ
          </Badge>
        );
      case 'consumer':
      default:
        return (
          <Badge variant="consumer" size="sm" className="gap-1">
            <User className="h-3 w-3" /> ผู้บริโภค
          </Badge>
        );
    }
  };

  const navLinks = [
    { label: 'หน้าแรก', href: '/' },
    { label: 'ค้นหาสินค้า', href: '/products' },
    { label: 'ส่งต่ออาหารชุมชน', href: '/shares' },
  ];

  if (role === 'store') {
    navLinks.push(
      { label: 'จัดการสินค้า', href: '/dashboard/store/products' },
      { label: 'ออเดอร์ร้านค้า', href: '/dashboard/store/orders' }
    );
  } else if (role === 'rider') {
    navLinks.push({ label: 'Pool งานจัดส่ง', href: '/dashboard/rider/jobs' });
  } else if (role === 'admin') {
    navLinks.push({ label: 'ผู้ดูแลระบบ', href: '/dashboard/admin' });
  } else if (role === 'consumer') {
    navLinks.push(
      { label: 'ออเดอร์ของฉัน', href: '/orders' },
      { label: 'ของที่ขอรับ', href: '/claims' }
    );
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center space-x-2.5 group">
          <div className="relative h-16 w-16 transition-transform duration-200 group-hover:scale-105 sm:h-20 sm:w-20">
            <Image src="/logoSS.png" alt="SecondServe" fill sizes="80px" className="object-contain" priority />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tight text-forest-900 leading-none">
              Second<span className="text-forest-600">Serve</span>
            </span>
            <span className="text-[10px] font-medium text-neutral-500 tracking-wider uppercase">
              More Than An Expiry Date
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center space-x-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-forest-50 text-forest-800 font-semibold'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop User Actions */}
        <div className="hidden md:flex items-center space-x-3">
          {showCart && <CartWidget />}
          {user ? (
            <div className="flex items-center space-x-3">
              {role && getRoleBadge(role)}
              {(() => {
                const identity = (
                  <>
                    <p className="text-xs font-semibold text-neutral-900 line-clamp-1">
                      {profile?.full_name || user.email}
                    </p>
                    <p className="text-[11px] text-neutral-500 line-clamp-1">
                      {profile?.phone || user.email}
                    </p>
                  </>
                );
                return role === 'consumer' ? (
                  <Link
                    href="/account"
                    title="บัญชีของฉัน"
                    className="rounded-lg px-2 py-1 text-right transition-colors hover:bg-neutral-100"
                  >
                    {identity}
                  </Link>
                ) : (
                  <div className="text-right">{identity}</div>
                );
              })()}

              <form action={signOut}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="text-neutral-500 hover:text-red-600"
                  title="ออกจากระบบ"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </form>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Link href="/login">
                <Button variant="ghost" size="sm" leftIcon={<LogIn className="h-4 w-4" />}>
                  เข้าสู่ระบบ
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="primary" size="sm" leftIcon={<UserPlus className="h-4 w-4" />}>
                  สมัครสมาชิก
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden items-center space-x-2">
          {showCart && <CartWidget />}
          {user && role && getRoleBadge(role)}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="border-t border-neutral-200 bg-white px-4 pt-3 pb-6 md:hidden space-y-3 animate-fadeIn">
          {user && (
            <div className="rounded-xl bg-neutral-50 p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-neutral-900">
                  {profile?.full_name || user.email}
                </p>
                <p className="text-xs text-neutral-500">{profile?.phone}</p>
                {role === 'consumer' && (
                  <Link
                    href="/account"
                    onClick={() => setIsOpen(false)}
                    className="mt-1 inline-block text-xs font-medium text-forest-700 underline"
                  >
                    แก้ไขโปรไฟล์
                  </Link>
                )}
              </div>
              {role && getRoleBadge(role)}
            </div>
          )}

          <nav className="flex flex-col space-y-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-forest-50 text-forest-800 font-semibold'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="pt-2 border-t border-neutral-100">
            {user ? (
              <form action={signOut} className="w-full">
                <Button
                  type="submit"
                  variant="outline"
                  size="md"
                  className="w-full text-red-600 border-red-200 hover:bg-red-50"
                  leftIcon={<LogOut className="h-4 w-4" />}
                >
                  ออกจากระบบ
                </Button>
              </form>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link href="/login" onClick={() => setIsOpen(false)} className="w-full">
                  <Button variant="outline" size="md" className="w-full">
                    เข้าสู่ระบบ
                  </Button>
                </Link>
                <Link href="/register" onClick={() => setIsOpen(false)} className="w-full">
                  <Button variant="primary" size="md" className="w-full">
                    สมัครสมาชิก
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
