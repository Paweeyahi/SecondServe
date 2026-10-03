'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Mail, MailCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { requestPasswordReset } from '@/lib/actions/password';

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await requestPasswordReset(formData);
    setIsLoading(false);
    if (result.error) setError(result.error);
    else setSentTo(String(formData.get('email')));
  }

  return (
    <div className="flex min-h-[calc(100vh-140px)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        <Card className="border-neutral-200/90 shadow-lg">
          <CardHeader>
            <CardTitle>ลืมรหัสผ่าน</CardTitle>
            <CardDescription>กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้</CardDescription>
          </CardHeader>

          {sentTo ? (
            <CardContent className="space-y-3 pb-6">
              <div className="flex items-start gap-3 rounded-xl border border-forest-200 bg-forest-50 p-4 text-sm text-forest-900">
                <MailCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-forest-700" />
                <p>
                  ถ้ามีบัญชีที่ใช้อีเมล <span className="font-semibold">{sentTo}</span> ระบบได้ส่งลิงก์ไปแล้ว
                  กรุณาตรวจสอบกล่องจดหมาย (รวมถึงโฟลเดอร์สแปม) ลิงก์ใช้ได้ครั้งเดียวและมีอายุจำกัด
                </p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => setSentTo(null)}>
                ส่งอีกครั้ง
              </Button>
            </CardContent>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
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
              </CardContent>
              <CardFooter className="pt-4">
                <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isLoading}>
                  ส่งลิงก์ตั้งรหัสผ่านใหม่
                </Button>
              </CardFooter>
            </form>
          )}
        </Card>

        <p className="text-center text-sm">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 font-semibold text-forest-700 hover:text-forest-900 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </div>
  );
}
