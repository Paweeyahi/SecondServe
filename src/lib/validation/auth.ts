import { z } from 'zod';

/**
 * Zod schemas for auth Server Actions (SKILL.md §3, §7).
 * Types are always inferred via `z.infer` — never hand-written.
 */

const email = z.string().trim().min(1, 'กรุณากรอกอีเมล').email('รูปแบบอีเมลไม่ถูกต้อง');
const password = z.string().min(6, 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');

export const SignInSchema = z.object({
  email,
  password: z.string().min(1, 'กรุณากรอกรหัสผ่าน'),
});
export type SignInInput = z.infer<typeof SignInSchema>;

const baseSignUp = z.object({
  email,
  password,
  full_name: z.string().trim().min(1, 'กรุณากรอกชื่อ-นามสกุล'),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9]{9,10}$/, 'เบอร์โทรศัพท์ต้องเป็นตัวเลข 9–10 หลัก'),
});

export const SignUpSchema = z.discriminatedUnion('role', [
  baseSignUp.extend({ role: z.literal('consumer') }),
  // No 'admin' branch on purpose: admin accounts are never self-service.
  baseSignUp.extend({
    role: z.literal('store'),
    store_name: z.string().trim().min(1, 'กรุณากรอกชื่อร้านค้า'),
    store_address: z.string().trim().min(1, 'กรุณากรอกที่อยู่ร้านค้า'),
  }),
  baseSignUp.extend({
    role: z.literal('rider'),
    vehicle_type: z.enum(['motorcycle', 'bicycle', 'car']),
    license_plate: z.string().trim().min(1, 'กรุณากรอกหมายเลขทะเบียนรถ'),
  }),
]);
export type SignUpInput = z.infer<typeof SignUpSchema>;

/**
 * Flatten a ZodError into a single Thai-language message for the form banner.
 */
export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง';
}
