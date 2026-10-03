'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/user';
import { firstIssueMessage } from '@/lib/validation/auth';
import { ProfileSchema } from '@/lib/validation/profile';

export interface ProfileActionResult {
  error?: string;
  success?: boolean;
}

/**
 * Updates the signed-in user's own name + phone. Only these two columns are
 * client-writable (column grants in migration-fix-column-privileges.sql);
 * role/suspended can never be changed from here.
 */
export async function updateMyProfile(formData: FormData): Promise<ProfileActionResult> {
  const parsed = ProfileSchema.safeParse({
    full_name: formData.get('full_name'),
    phone: formData.get('phone'),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const user = await getAuthUser();
  if (!user) return { error: 'กรุณาเข้าสู่ระบบ' };

  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: parsed.data.full_name, phone: parsed.data.phone })
    .eq('id', user.id)
    .select('id');

  if (error) return { error: `บันทึกไม่สำเร็จ: ${error.message}` };
  if (!data || data.length === 0) return { error: 'ไม่พบบัญชีของคุณ' };

  revalidatePath('/', 'layout');
  return { success: true };
}
