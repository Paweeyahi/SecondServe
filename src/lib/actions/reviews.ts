'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { firstIssueMessage } from '@/lib/validation/auth';

const SubmitReviewSchema = z.object({
  orderId: z.string().uuid(),
  target: z.enum(['store', 'rider']),
  rating: z.coerce.number().int().min(1, 'กรุณาให้คะแนน').max(5),
  comment: z.string().trim().max(1000, 'ความคิดเห็นยาวเกินไป').optional(),
});

export interface ReviewActionResult {
  error?: string;
  success?: boolean;
}

function friendlyReviewError(message: string): string {
  const map: Record<string, string> = {
    AUTH_REQUIRED: 'กรุณาเข้าสู่ระบบ',
    BAD_RATING: 'กรุณาให้คะแนน 1-5 ดาว',
    BAD_TARGET: 'เป้าหมายรีวิวไม่ถูกต้อง',
    ORDER_NOT_FOUND: 'ไม่พบออเดอร์นี้',
    NOT_YOUR_ORDER: 'ไม่ใช่ออเดอร์ของคุณ',
    ORDER_NOT_COMPLETED: 'รีวิวได้เมื่อออเดอร์เสร็จสิ้นแล้วเท่านั้น',
    NO_RIDER_ON_ORDER: 'ออเดอร์นี้ไม่มีไรเดอร์ให้รีวิว',
    ALREADY_REVIEWED: 'คุณรีวิวไปแล้ว',
  };
  return map[message] ?? `ส่งรีวิวไม่สำเร็จ: ${message}`;
}

/** A consumer rates + comments on the store or rider behind their own completed order. */
export async function submitReview(input: {
  orderId: string;
  target: 'store' | 'rider';
  rating: number;
  comment?: string;
}): Promise<ReviewActionResult> {
  const parsed = SubmitReviewSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = createClient();
  const { error } = await supabase.rpc('submit_review', {
    p_order_id: parsed.data.orderId,
    p_target: parsed.data.target,
    p_rating: parsed.data.rating,
    p_comment: parsed.data.comment ?? null,
  });

  if (error) return { error: friendlyReviewError(error.message) };

  revalidatePath(`/orders/${parsed.data.orderId}`);
  return { success: true };
}
