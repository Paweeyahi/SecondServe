'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { firstIssueMessage } from '@/lib/validation/auth';
import { FoundationSchema, type FoundationInput } from '@/lib/validation/foundation';
import { z } from 'zod';

export interface AdminActionResult {
  error?: string;
  success?: boolean;
}

function friendlyAdminError(message: string): string {
  const map: Record<string, string> = {
    ADMIN_ONLY: 'เฉพาะแอดมินเท่านั้นที่ดำเนินการนี้ได้',
    NOT_FOUND: 'ไม่พบข้อมูลนี้',
    CANNOT_SUSPEND_SELF: 'ไม่สามารถระงับบัญชีของตัวเองได้',
    NAME_REQUIRED: 'กรุณากรอกชื่อมูลนิธิ',
    BAD_RATE: 'อัตราค่าคอมมิชชันต้องอยู่ระหว่าง 0–50%',
  };
  return map[message] ?? `ดำเนินการไม่สำเร็จ: ${message}`;
}

function revalidateAdmin() {
  revalidatePath('/dashboard/admin');
  revalidatePath('/dashboard/admin/users');
  revalidatePath('/dashboard/admin/stores');
  revalidatePath('/dashboard/admin/riders');
  revalidatePath('/products');
}

export async function setStoreVerified(
  storeId: string,
  verified: boolean
): Promise<AdminActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc('admin_set_store_verified', {
    p_store_id: storeId,
    p_verified: verified,
  });
  if (error) return { error: friendlyAdminError(error.message) };
  revalidateAdmin();
  return { success: true };
}

export async function setRiderVerified(
  riderId: string,
  verified: boolean
): Promise<AdminActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc('admin_set_rider_verified', {
    p_rider_id: riderId,
    p_verified: verified,
  });
  if (error) return { error: friendlyAdminError(error.message) };
  revalidateAdmin();
  return { success: true };
}

export async function setUserSuspended(
  userId: string,
  suspended: boolean
): Promise<AdminActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc('admin_set_user_suspended', {
    p_user_id: userId,
    p_suspended: suspended,
  });
  if (error) return { error: friendlyAdminError(error.message) };
  revalidateAdmin();
  return { success: true };
}

/** Admin create (id null) or edit of a donation-recipient foundation. */
export async function saveFoundation(input: FoundationInput): Promise<AdminActionResult> {
  const parsed = FoundationSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const f = parsed.data;
  const supabase = createClient();
  const { error } = await supabase.rpc('admin_save_foundation', {
    p_id: f.id,
    p_name: f.name,
    p_description: f.description,
    p_address: f.address,
    p_phone: f.phone,
    p_active: f.active,
  });
  if (error) return { error: friendlyAdminError(error.message) };

  revalidatePath('/dashboard/admin/foundations');
  revalidatePath('/dashboard/store/products');
  revalidatePath('/shares');
  return { success: true };
}

const CommissionPercentSchema = z.coerce
  .number({ invalid_type_error: 'กรุณากรอกตัวเลข' })
  .min(0, 'อัตราค่าคอมมิชชันต้องไม่ติดลบ')
  .max(50, 'อัตราค่าคอมมิชชันต้องไม่เกิน 50%');

/**
 * Change the platform commission rate (entered as a percent). Only affects
 * orders placed after the change -- each order keeps the rate it was placed at.
 */
export async function setCommissionRate(percent: number): Promise<AdminActionResult> {
  const parsed = CommissionPercentSchema.safeParse(percent);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = createClient();
  const { error } = await supabase.rpc('admin_set_commission_rate', {
    p_rate: Math.round(parsed.data * 100) / 10000,
  });
  if (error) return { error: friendlyAdminError(error.message) };

  revalidatePath('/dashboard/admin');
  revalidatePath('/dashboard/admin/users');
  revalidatePath('/dashboard/store');
  return { success: true };
}
