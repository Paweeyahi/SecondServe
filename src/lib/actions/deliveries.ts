'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface DeliveryActionResult {
  error?: string;
  success?: boolean;
}

function friendlyDeliveryError(message: string): string {
  const map: Record<string, string> = {
    AUTH_REQUIRED: 'กรุณาเข้าสู่ระบบ',
    BAD_STATUS: 'สถานะไม่ถูกต้อง',
    RIDER_BUSY_OR_NOT_FOUND: 'ไม่สามารถเปลี่ยนสถานะได้ขณะกำลังจัดส่งงานอยู่',
    RIDER_NOT_AVAILABLE: 'บัญชียังไม่ได้รับการยืนยัน หรือยังไม่ได้เปิดรับงาน',
    JOB_ALREADY_TAKEN: 'งานนี้ถูกไรเดอร์คนอื่นรับไปแล้ว',
    STALE_OR_FORBIDDEN: 'ไม่สามารถอัปเดตงานนี้ได้ อาจมีการเปลี่ยนสถานะไปแล้ว',
  };
  return map[message] ?? `ดำเนินการไม่สำเร็จ: ${message}`;
}

function revalidateRider(orderId?: string) {
  revalidatePath('/dashboard/rider');
  revalidatePath('/dashboard/rider/jobs');
  if (orderId) revalidatePath(`/dashboard/rider/jobs/${orderId}`);
}

/** Shift toggle: available <-> offline (blocked while busy on a job). */
export async function setShiftStatus(
  status: 'available' | 'offline'
): Promise<DeliveryActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc('set_rider_shift', { p_status: status });
  if (error) return { error: friendlyDeliveryError(error.message) };
  revalidateRider();
  return { success: true };
}

/** Atomic race-free claim from the Job Pool. */
export async function claimJob(orderId: string): Promise<DeliveryActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc('claim_delivery_job', { p_order_id: orderId });
  if (error) return { error: friendlyDeliveryError(error.message) };
  revalidateRider(orderId);
  return { success: true };
}

/** rider_assigned -> picked_up */
export async function markPickedUp(orderId: string): Promise<DeliveryActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc('mark_picked_up', { p_order_id: orderId });
  if (error) return { error: friendlyDeliveryError(error.message) };
  revalidateRider(orderId);
  return { success: true };
}

/** picked_up -> delivering */
export async function markDelivering(orderId: string): Promise<DeliveryActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc('mark_delivering', { p_order_id: orderId });
  if (error) return { error: friendlyDeliveryError(error.message) };
  revalidateRider(orderId);
  return { success: true };
}

/** delivering -> completed; returns the rider to available */
export async function markDelivered(orderId: string): Promise<DeliveryActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc('mark_delivered', { p_order_id: orderId });
  if (error) return { error: friendlyDeliveryError(error.message) };
  revalidateRider(orderId);
  return { success: true };
}
