'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/user';
import { firstIssueMessage } from '@/lib/validation/auth';
import { NewPasswordSchema, ResetRequestSchema } from '@/lib/validation/password';

export interface PasswordActionResult {
  error?: string;
  success?: boolean;
}

/** Where the reset email's link should land (this site's /auth/callback). */
function siteOrigin(): string {
  const h = headers();
  return (
    h.get('origin') ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`
  );
}

/**
 * Emails a password-reset link. Always reports success for a well-formed
 * address, so the form can't be used to discover which emails have accounts.
 */
export async function requestPasswordReset(formData: FormData): Promise<PasswordActionResult> {
  const parsed = ResetRequestSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteOrigin()}/auth/callback?next=/reset-password`,
  });

  if (error) {
    // Rate limits are worth telling the user about; anything else stays generic.
    if (error.status === 429 || /rate limit/i.test(error.message)) {
      return { error: 'ขอลิงก์บ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่' };
    }
    console.error('[requestPasswordReset]', error.message);
  }
  return { success: true };
}

/** Sets a new password for the user signed in via the reset link. */
export async function updatePassword(formData: FormData): Promise<PasswordActionResult> {
  const parsed = NewPasswordSchema.safeParse({
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const user = await getAuthUser();
  if (!user) return { error: 'ลิงก์รีเซ็ตรหัสผ่านหมดอายุหรือไม่ถูกต้อง กรุณาขอลิงก์ใหม่' };

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (/different from the old password/i.test(error.message)) {
      return { error: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม' };
    }
    return { error: `ตั้งรหัสผ่านใหม่ไม่สำเร็จ: ${error.message}` };
  }
  return { success: true };
}
