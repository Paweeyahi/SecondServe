import { z } from 'zod';
import { PRODUCT_CATEGORY_KEYS, type ProductCategory } from '@/types/product';

/**
 * Product form validation (SKILL.md §7). Business invariants are enforced here
 * *and* by DB CHECK constraints (docs/migration-m2-products.sql).
 */

const money = z.coerce
  .number({ invalid_type_error: 'กรุณากรอกราคาเป็นตัวเลข' })
  .finite();

const baseProduct = z.object({
  name: z.string().trim().min(1, 'กรุณากรอกชื่อสินค้า').max(120, 'ชื่อสินค้ายาวเกินไป'),
  category: z.enum(
    PRODUCT_CATEGORY_KEYS as [ProductCategory, ...ProductCategory[]],
    { errorMap: () => ({ message: 'กรุณาเลือกหมวดหมู่สินค้า' }) }
  ),
  original_price: money.refine((v) => v > 0, 'ราคาปกติต้องมากกว่า 0'),
  discount_price: money.refine((v) => v >= 0, 'ราคาลดต้องไม่ติดลบ'),
  quantity: z.coerce
    .number({ invalid_type_error: 'จำนวนต้องเป็นตัวเลข' })
    .int('จำนวนต้องเป็นจำนวนเต็ม')
    .min(0, 'จำนวนต้องไม่ติดลบ'),
  expiry_date: z.coerce.date({ invalid_type_error: 'กรุณาระบุวันหมดอายุ' }),
});

export const ProductCreateSchema = baseProduct
  .refine((d) => d.discount_price < d.original_price, {
    message: 'ราคาลดต้องน้อยกว่าราคาปกติ',
    path: ['discount_price'],
  })
  .refine((d) => d.expiry_date.getTime() > Date.now(), {
    message: 'วันหมดอายุต้องเป็นวันในอนาคต',
    path: ['expiry_date'],
  });
export type ProductCreateInput = z.infer<typeof ProductCreateSchema>;

// On edit, allow a product whose expiry has already passed to be saved
// (the store may be correcting other fields); the price rule still applies.
export const ProductUpdateSchema = baseProduct.refine(
  (d) => d.discount_price < d.original_price,
  { message: 'ราคาลดต้องน้อยกว่าราคาปกติ', path: ['discount_price'] }
);
export type ProductUpdateInput = z.infer<typeof ProductUpdateSchema>;

// 'shared' is set only by share_product() (it also writes the donation log).
export const ProductStatusSchema = z.enum(['active', 'sold_out', 'expired']);
