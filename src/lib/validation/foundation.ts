import { z } from 'zod';

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((v) => (v ? v : null));

/** Admin foundation form (mirrors the CHECKs on public.foundations). */
export const FoundationSchema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(1, 'กรุณากรอกชื่อมูลนิธิ').max(120, 'ชื่อยาวเกิน 120 ตัวอักษร'),
  description: optionalText(500, 'รายละเอียดยาวเกิน 500 ตัวอักษร'),
  address: optionalText(300, 'ที่อยู่ยาวเกิน 300 ตัวอักษร'),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^[0-9-]{9,20}$/.test(v), 'เบอร์โทรศัพท์ไม่ถูกต้อง'),
  active: z.boolean(),
});

export type FoundationInput = z.input<typeof FoundationSchema>;
