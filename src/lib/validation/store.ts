import { z } from 'zod';

/** Store profile form validation (SKILL.md §7). */
export const StoreProfileSchema = z.object({
  name: z.string().trim().min(1, 'กรุณากรอกชื่อร้านค้า').max(120),
  address: z.string().trim().min(1, 'กรุณากรอกที่อยู่ร้านค้า'),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9]{9,10}$/, 'เบอร์โทรศัพท์ต้องเป็นตัวเลข 9–10 หลัก'),
  latitude: z.coerce
    .number({ invalid_type_error: 'ละติจูดต้องเป็นตัวเลข' })
    .min(-90, 'ละติจูดต้องอยู่ระหว่าง -90 ถึง 90')
    .max(90, 'ละติจูดต้องอยู่ระหว่าง -90 ถึง 90'),
  longitude: z.coerce
    .number({ invalid_type_error: 'ลองจิจูดต้องเป็นตัวเลข' })
    .min(-180, 'ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180')
    .max(180, 'ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180'),
  delivery_fee: z.coerce
    .number({ invalid_type_error: 'ค่าจัดส่งต้องเป็นตัวเลข' })
    .min(0, 'ค่าจัดส่งต้องไม่ติดลบ'),
});
export type StoreProfileInput = z.infer<typeof StoreProfileSchema>;
