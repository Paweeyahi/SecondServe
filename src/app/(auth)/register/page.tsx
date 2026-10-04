'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Phone,
  Store,
  Bike,
  ShoppingBag,
  MapPin,
  Car,
  AlertCircle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { signUp, type AuthActionResult } from '@/lib/actions/auth';
import type { UserRole } from '@/types/roles';

export default function RegisterPage() {
  const [selectedRole, setSelectedRole] = useState<'consumer' | 'store' | 'rider'>('consumer');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set('role', selectedRole);

    try {
      const result: AuthActionResult = await signUp(null, formData);
      if (result?.error) {
        setError(result.error);
      } else if (result?.needsConfirmation) {
        setConfirmEmail(String(formData.get('email')));
      }
    } catch (err: unknown) {
      if ((err as Error)?.message?.includes('NEXT_REDIRECT')) {
        throw err;
      }
      setError('เกิดข้อผิดพลาดในการลงทะเบียน กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsLoading(false);
    }
  }

  if (confirmEmail) {
    return (
      <div className="flex min-h-[calc(100vh-140px)] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="space-y-4 p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-100 text-forest-800">
              <Mail className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold text-forest-900">ยืนยันอีเมลเพื่อเริ่มใช้งาน</h2>
            <p className="text-sm text-neutral-600">
              เราส่งลิงก์ยืนยันไปที่ <span className="font-semibold">{confirmEmail}</span> แล้ว
              กดลิงก์ในอีเมลเพื่อเปิดใช้บัญชี (ถ้าไม่เห็น ลองดูในโฟลเดอร์สแปม)
            </p>
            <Link href="/login" className="block">
              <Button variant="outline" className="w-full">
                ไปหน้าเข้าสู่ระบบ
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-140px)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="relative mx-auto h-32 w-32">
            <Image src="/logoSS.png" alt="SecondServe" fill sizes="128px" className="object-contain" priority />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-forest-900 sm:text-3xl">
            สร้างบัญชีผู้ใช้ใหม่
          </h2>
          <p className="text-sm text-neutral-500">
            ร่วมเป็นส่วนหนึ่งของเครือข่ายลดขยะอาหารอย่างยั่งยืน
          </p>
        </div>

        <Card className="shadow-lg border-neutral-200/90">
          <CardHeader>
            <CardTitle>เลือกบทบาทการใช้งาน</CardTitle>
            <CardDescription>
              เลือกรูปแบบที่คุณต้องการใช้งาน SecondServe
            </CardDescription>

            {/* Role Selection Tabs */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedRole('consumer')}
                className={`flex flex-col items-center justify-center rounded-xl p-3 text-center transition-all duration-150 border ${
                  selectedRole === 'consumer'
                    ? 'border-forest-700 bg-forest-50/80 text-forest-900 ring-2 ring-forest-700/20 shadow-sm'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <ShoppingBag className={`h-5 w-5 mb-1 ${selectedRole === 'consumer' ? 'text-forest-700' : 'text-neutral-500'}`} />
                <span className="text-xs font-bold">ผู้บริโภค</span>
                <span className="text-[10px] text-neutral-500 hidden sm:inline">ซื้อสินค้า</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole('store')}
                className={`flex flex-col items-center justify-center rounded-xl p-3 text-center transition-all duration-150 border ${
                  selectedRole === 'store'
                    ? 'border-amber-600 bg-amber-50/80 text-amber-900 ring-2 ring-amber-600/20 shadow-sm'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <Store className={`h-5 w-5 mb-1 ${selectedRole === 'store' ? 'text-amber-600' : 'text-neutral-500'}`} />
                <span className="text-xs font-bold">ร้านค้า</span>
                <span className="text-[10px] text-neutral-500 hidden sm:inline">จัดการสินค้า</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole('rider')}
                className={`flex flex-col items-center justify-center rounded-xl p-3 text-center transition-all duration-150 border ${
                  selectedRole === 'rider'
                    ? 'border-sky-600 bg-sky-50/80 text-sky-900 ring-2 ring-sky-600/20 shadow-sm'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <Bike className={`h-5 w-5 mb-1 ${selectedRole === 'rider' ? 'text-sky-600' : 'text-neutral-500'}`} />
                <span className="text-xs font-bold">ไรเดอร์</span>
                <span className="text-[10px] text-neutral-500 hidden sm:inline">รับงานจัดส่ง</span>
              </button>
            </div>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3.5 text-sm text-red-700 border border-red-200 animate-fadeIn">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
                  <span>{error}</span>
                </div>
              )}

              {/* General User Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="ชื่อ-นามสกุล"
                  name="full_name"
                  type="text"
                  required
                  placeholder="สมชาย ใจดี"
                  leftIcon={<User className="h-4 w-4" />}
                />
                <Input
                  label="เบอร์โทรศัพท์"
                  name="phone"
                  type="tel"
                  required
                  placeholder="0812345678"
                  leftIcon={<Phone className="h-4 w-4" />}
                />
              </div>

              <Input
                label="อีเมล (Email)"
                name="email"
                type="email"
                required
                placeholder="name@example.com"
                autoComplete="email"
                leftIcon={<Mail className="h-4 w-4" />}
              />

              <Input
                label="รหัสผ่าน (Password)"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="อย่างน้อย 6 ตัวอักษร"
                autoComplete="new-password"
                leftIcon={<Lock className="h-4 w-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-neutral-400 hover:text-neutral-600 focus:outline-none"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                }
              />

              {/* Store-specific fields */}
              {selectedRole === 'store' && (
                <div className="space-y-3 rounded-xl bg-amber-50/50 p-3.5 border border-amber-200 animate-fadeIn">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <Store className="h-4 w-4 text-amber-700" /> ข้อมูลร้านค้าเริ่มต้น
                  </div>
                  <Input
                    label="ชื่อร้านค้า"
                    name="store_name"
                    type="text"
                    required
                    placeholder="เช่น ร้านสดใส กรีนมาร์เก็ต"
                    leftIcon={<Store className="h-4 w-4" />}
                  />
                  <Input
                    label="ที่อยู่ร้านค้า"
                    name="store_address"
                    type="text"
                    required
                    placeholder="เช่น 123 ถ.สุขุมวิท เขตคลองเตย กทม."
                    leftIcon={<MapPin className="h-4 w-4" />}
                  />
                </div>
              )}

              {/* Rider-specific fields */}
              {selectedRole === 'rider' && (
                <div className="space-y-3 rounded-xl bg-sky-50/50 p-3.5 border border-sky-200 animate-fadeIn">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-sky-900">
                    <Bike className="h-4 w-4 text-sky-700" /> ข้อมูลยานพาหนะของไรเดอร์
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-neutral-700">
                      ประเภทยานพาหนะ
                    </label>
                    <select
                      name="vehicle_type"
                      className="block w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/20"
                    >
                      <option value="motorcycle">มอเตอร์ไซค์ (Motorcycle)</option>
                      <option value="bicycle">จักรยาน (Bicycle)</option>
                      <option value="car">รถยนต์ (Car)</option>
                    </select>
                  </div>
                  <Input
                    label="หมายเลขทะเบียนรถ"
                    name="license_plate"
                    type="text"
                    required
                    placeholder="เช่น 1กข 1234 กทม."
                    leftIcon={<Car className="h-4 w-4" />}
                  />
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-col space-y-3">
              <label className="flex w-full items-start gap-2.5 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
                <input
                  type="checkbox"
                  name="accept_terms"
                  required
                  className="mt-0.5 h-4 w-4 flex-shrink-0 accent-forest-700"
                />
                <span>
                  ฉันได้อ่านและยอมรับ{' '}
                  <Link href="/privacy" target="_blank" className="font-semibold text-forest-800 underline">
                    นโยบายความเป็นส่วนตัว
                  </Link>{' '}
                  และ{' '}
                  <Link href="/terms" target="_blank" className="font-semibold text-forest-800 underline">
                    ข้อกำหนดการใช้งาน
                  </Link>{' '}
                  รวมถึงยินยอมให้ส่งชื่อ เบอร์โทร และที่อยู่ของฉันให้ร้านค้าและไรเดอร์ที่เกี่ยวข้องกับคำสั่งซื้อ
                </span>
              </label>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={isLoading}
              >
                ยืนยันการสมัครสมาชิก
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Switch to Login */}
        <p className="text-center text-sm text-neutral-600">
          มีบัญชีผู้ใช้งานอยู่แล้ว?{' '}
          <Link
            href="/login"
            className="font-semibold text-forest-700 hover:text-forest-900 hover:underline"
          >
            เข้าสู่ระบบที่นี่
          </Link>
        </p>
      </div>
    </div>
  );
}
