import { z } from 'zod';

/** Consumer profile edit form -- mirrors the signup rules for these fields. */
export const ProfileSchema = z.object({
  full_name: z.string().trim().min(1, 'กรุณากรอกชื่อ-นามสกุล').max(120, 'ชื่อยาวเกิน 120 ตัวอักษร'),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9]{9,10}$/, 'เบอร์โทรศัพท์ต้องเป็นตัวเลข 9–10 หลัก'),
});
export type ProfileInput = z.infer<typeof ProfileSchema>;
