'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { updatePassword } from '@/lib/actions/password';

/**
 * Landing page of the reset email. /auth/callback has already exchanged the
 * link's code for a session, so the user is signed in here and can set a
 * new password.
 */
export default function ResetPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    const result = await updatePassword(new FormData(e.currentTarget));
    setIsLoading(false);
    if (result.error) setError(result.error);
    else setDone(true);
  }

  return (
    <div className="flex min-h-[calc(100vh-140px)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <Card className="border-neutral-200/90 shadow-lg">
          <CardHeader>
            <CardTitle>ตั้งรหัสผ่านใหม่</CardTitle>
            <CardDescription>รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร</CardDescription>
          </CardHeader>

          {done ? (
            <CardContent className="space-y-3 pb-6">
              <div className="flex items-center gap-3 rounded-xl border border-forest-200 bg-forest-50 p-4 text-sm text-forest-900">
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-forest-700" />
                ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว คุณเข้าสู่ระบบอยู่ในขณะนี้
              </div>
              <Link href="/" className="block">
                <Button variant="primary" className="w-full">
                  ไปหน้าแรก
                </Button>
              </Link>
            </CardContent>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {error && (
                  <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
                    <p className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
                      {error}
                    </p>
                    {error.includes('หมดอายุ') && (
                      <Link href="/forgot-password" className="inline-block font-semibold underline">
                        ขอลิงก์ใหม่
                      </Link>
                    )}
                  </div>
                )}
                <Input
                  label="รหัสผ่านใหม่"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  leftIcon={<Lock className="h-4 w-4" />}
                />
                <Input
                  label="ยืนยันรหัสผ่านใหม่"
                  name="confirm"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  leftIcon={<Lock className="h-4 w-4" />}
                />
              </CardContent>
              <CardFooter className="pt-4">
                <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isLoading}>
                  บันทึกรหัสผ่านใหม่
                </Button>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
