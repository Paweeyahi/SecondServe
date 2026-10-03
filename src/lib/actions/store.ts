'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/user';
import { StoreProfileSchema } from '@/lib/validation/store';
import { firstIssueMessage } from '@/lib/validation/auth';

export interface ActionResult {
  error?: string;
  success?: boolean;
}

/** Update the authenticated store owner's profile (name, address, fee, coords). */
export async function updateStoreProfile(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = StoreProfileSchema.safeParse({
    name: formData.get('name'),
    address: formData.get('address'),
    phone: formData.get('phone'),
    latitude: formData.get('latitude'),
    longitude: formData.get('longitude'),
    delivery_fee: formData.get('delivery_fee'),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const user = await getAuthUser();
  if (!user) return { error: 'กรุณาเข้าสู่ระบบ' };

  const supabase = createClient();
  const { data, error } = await supabase
    .from('stores')
    .update(parsed.data)
    .eq('owner_id', user.id)
    .select('id');

  if (error) return { error: `บันทึกไม่สำเร็จ: ${error.message}` };
  if (!data || data.length === 0) {
    return { error: 'ไม่พบร้านค้าของคุณ หรือไม่มีสิทธิ์แก้ไข (ตรวจสอบ RLS policy ของตาราง stores)' };
  }

  revalidatePath('/dashboard/store', 'layout');
  return { success: true };
}
