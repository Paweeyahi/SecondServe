import { z } from 'zod';
import { MAX_CLAIM_QUANTITY } from '@/types/share';
import { PRODUCT_CATEGORY_KEYS } from '@/types/product';

export const PickupNoteSchema = z
  .string()
  .trim()
  .max(200, 'หมายเหตุการรับของต้องไม่เกิน 200 ตัวอักษร')
  .optional();

export const ClaimShareSchema = z.object({
  shareId: z.string().uuid('รายการไม่ถูกต้อง'),
  quantity: z.coerce
    .number()
    .int('จำนวนต้องเป็นจำนวนเต็ม')
    .min(1, 'ขอรับอย่างน้อย 1 ชิ้น')
    .max(MAX_CLAIM_QUANTITY, `ขอรับได้สูงสุด ${MAX_CLAIM_QUANTITY} ชิ้นต่อรายการ`),
});

export type ShareFeedView = 'available' | 'all';

export interface ShareFeedFilters {
  view: ShareFeedView;
  category: string | null;
  page: number;
}

/** Parses /shares query params, falling back to safe defaults on anything odd. */
export function parseShareFeedFilters(
  searchParams: Record<string, string | string[] | undefined>
): ShareFeedFilters {
  const one = (key: string) => {
    const v = searchParams[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const view: ShareFeedView = one('view') === 'all' ? 'all' : 'available';
  const rawCategory = one('category');
  const category =
    rawCategory && (PRODUCT_CATEGORY_KEYS as string[]).includes(rawCategory) ? rawCategory : null;
  const pageNum = Number.parseInt(one('page') ?? '1', 10);
  const page = Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1;

  return { view, category, page };
}
