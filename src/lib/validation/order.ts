import { z } from 'zod';

/** Checkout payload validation (SKILL.md §7). Amounts are NOT trusted from the
 *  client — the server recomputes prices, fee and totals from the database. */
export const CreateOrderSchema = z
  .object({
    storeId: z.string().uuid('ข้อมูลร้านค้าไม่ถูกต้อง'),
    deliveryType: z.enum(['pickup', 'delivery']),
    deliveryAddress: z.string().trim().max(500).optional().default(''),
    items: z
      .array(
        z.object({
          productId: z.string().uuid(),
          quantity: z.number().int().min(1).max(99),
        })
      )
      .min(1, 'ตะกร้าว่างเปล่า'),
  })
  .refine(
    (d) => d.deliveryType !== 'delivery' || d.deliveryAddress.trim().length > 0,
    { message: 'กรุณากรอกที่อยู่จัดส่ง', path: ['deliveryAddress'] }
  );

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
