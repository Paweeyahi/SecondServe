'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { firstIssueMessage } from '@/lib/validation/auth';
import { ClaimShareSchema, PickupNoteSchema } from '@/lib/validation/share';

export interface DonationActionResult {
  error?: string;
  success?: boolean;
}

function friendlyDonationError(message: string): string {
  const map: Record<string, string> = {
    AUTH_REQUIRED: 'กรุณาเข้าสู่ระบบ',
    NOT_FOUND_OR_FORBIDDEN: 'ไม่พบรายการนี้ หรือคุณไม่มีสิทธิ์จัดการ',
    NOTHING_TO_SHARE: 'สินค้านี้ไม่มีสต็อกเหลือให้แชร์',
    PRODUCT_EXPIRED: 'สินค้านี้หมดอายุแล้ว ไม่สามารถส่งต่อให้ชุมชนได้',
    NOTE_TOO_LONG: 'หมายเหตุการรับของต้องไม่เกิน 200 ตัวอักษร',
    CONSUMER_ONLY: 'เฉพาะบัญชีผู้บริโภคเท่านั้นที่ขอรับของบริจาคได้',
    BAD_QUANTITY: 'จำนวนที่ขอรับไม่ถูกต้อง',
    NOT_FOUND: 'ไม่พบรายการบริจาคนี้',
    SHARE_EXPIRED: 'ของบริจาคนี้หมดอายุแล้ว',
    STORE_UNAVAILABLE: 'ร้านค้านี้ไม่พร้อมให้บริการในตอนนี้',
    ALREADY_CLAIMED: 'คุณขอรับรายการนี้ไปแล้ว',
    NOT_ENOUGH_LEFT: 'ของเหลือไม่พอตามจำนวนที่ขอ กรุณาลดจำนวนลง',
    NOT_RESERVED: 'รายการนี้ไม่ได้อยู่ในสถานะรอรับของแล้ว',
    NOT_FOUND_OR_NOT_RESERVED: 'รายการนี้ไม่ได้อยู่ในสถานะรอรับของแล้ว',
    FOUNDATION_UNAVAILABLE: 'มูลนิธินี้ไม่ได้เปิดรับบริจาคแล้ว กรุณาเลือกใหม่',
    NOT_FOUND_OR_ALREADY_DELIVERED: 'รายการนี้ถูกยืนยันส่งมอบไปแล้ว',
  };
  return map[message] ?? `ทำรายการไม่สำเร็จ: ${message}`;
}

function revalidateDonationPaths() {
  revalidatePath('/shares');
  revalidatePath('/claims');
  revalidatePath('/dashboard/store/shares');
}

/** Diverts a product's entire remaining stock to community sharing (D3-style atomic write). */
export async function shareProduct(
  productId: string,
  pickupNote?: string,
  foundationId?: string | null
): Promise<DonationActionResult> {
  const parsed = PickupNoteSchema.safeParse(pickupNote);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };
  const foundation = z.string().uuid().nullable().safeParse(foundationId || null);
  if (!foundation.success) return { error: 'มูลนิธิที่เลือกไม่ถูกต้อง' };

  const supabase = createClient();
  const { error } = await supabase.rpc('share_product', {
    p_product_id: productId,
    p_pickup_note: parsed.data || null,
    p_foundation_id: foundation.data,
  });
  if (error) return { error: friendlyDonationError(error.message) };

  revalidatePath('/dashboard/store/products');
  revalidatePath('/products');
  revalidateDonationPaths();
  return { success: true };
}

/** Consumer reserves pieces from a community donation (row-locked in claim_share()). */
export async function claimShare(
  shareId: string,
  quantity: number
): Promise<DonationActionResult> {
  const parsed = ClaimShareSchema.safeParse({ shareId, quantity });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = createClient();
  const { error } = await supabase.rpc('claim_share', {
    p_share_id: parsed.data.shareId,
    p_quantity: parsed.data.quantity,
  });
  if (error) return { error: friendlyDonationError(error.message) };

  revalidateDonationPaths();
  return { success: true };
}

/** Claimer or donating store cancels a reservation; pieces return to the pool. */
export async function cancelShareClaim(claimId: string): Promise<DonationActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc('cancel_share_claim', { p_claim_id: claimId });
  if (error) return { error: friendlyDonationError(error.message) };

  revalidateDonationPaths();
  return { success: true };
}

/** Donating store confirms the claimer picked the food up. */
export async function markShareCollected(claimId: string): Promise<DonationActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc('mark_share_collected', { p_claim_id: claimId });
  if (error) return { error: friendlyDonationError(error.message) };

  revalidateDonationPaths();
  return { success: true };
}

/** Donating store confirms a foundation-earmarked share was handed over. */
export async function markFoundationDelivered(shareId: string): Promise<DonationActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc('mark_foundation_delivered', { p_share_id: shareId });
  if (error) return { error: friendlyDonationError(error.message) };

  revalidateDonationPaths();
  return { success: true };
}
