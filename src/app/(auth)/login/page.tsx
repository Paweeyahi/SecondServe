'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { signIn, type AuthActionResult } from '@/lib/actions/auth';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // /auth/callback sends people here when an email link (e.g. password
  // reset) was expired or already used.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('error') === 'auth_callback_failed') {
      setError('ลิงก์ในอีเมลหมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่');
    }
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    // Return to the page that sent the user here (?next=...); the server
    // action validates it before redirecting.
    const next = new URLSearchParams(window.location.search).get('next');
    if (next) formData.set('next', next);
    try {
      const result: AuthActionResult = await signIn(null, formData);
      if (result?.error) {
        setError(result.error);
      }
    } catch (err: unknown) {
      // Next.js redirect throws a NEXT_REDIRECT error internally, which is expected
      if ((err as Error)?.message?.includes('NEXT_REDIRECT')) {
        throw err;
      }
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-140px)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="relative mx-auto h-32 w-32">
            <Image src="/logoSS.png" alt="SecondServe" fill sizes="128px" className="object-contain" priority />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-forest-900 sm:text-3xl">
            ยินดีต้อนรับกลับมา
          </h2>
          <p className="text-sm text-neutral-500">
            เข้าสู่ระบบ SecondServe เพื่อเริ่มส่งต่อและเลือกซื้อสินค้า
          </p>
        </div>

        <Card className="shadow-lg border-neutral-200/90">
          <CardHeader>
            <CardTitle>เข้าสู่ระบบ</CardTitle>
            <CardDescription>
              กรอกอีเมลและรหัสผ่านของคุณเพื่อเข้าใช้งาน
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3.5 text-sm text-red-700 border border-red-200 animate-fadeIn">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
                  <span>{error}</span>
                </div>
              )}

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
                placeholder="••••••••"
                autoComplete="current-password"
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
              <div className="-mt-1 text-right">
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-forest-700 hover:text-forest-900 hover:underline"
                >
                  ลืมรหัสผ่าน?
                </Link>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-3">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={isLoading}
              >
                เข้าสู่ระบบ
              </Button>

              <div className="rounded-xl bg-forest-50/70 p-3 text-center text-xs text-forest-800 border border-forest-100">
                ระบบจะนำทางไปยัง Dashboard หรือหน้าแรกตามบทบาทของคุณโดยอัตโนมัติ
              </div>
            </CardFooter>
          </form>
        </Card>

        {/* Switch to Register */}
        <p className="text-center text-sm text-neutral-600">
          ยังไม่มีบัญชี SecondServe?{' '}
          <Link
            href="/register"
            className="font-semibold text-forest-700 hover:text-forest-900 hover:underline"
          >
            สมัครสมาชิกใหม่
          </Link>
        </p>
      </div>
    </div>
  );
}
