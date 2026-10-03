import { z } from 'zod';

export const ResetRequestSchema = z.object({
  email: z.string().trim().min(1, 'กรุณากรอกอีเมล').email('รูปแบบอีเมลไม่ถูกต้อง'),
});

export const NewPasswordSchema = z
  .object({
    password: z.string().min(6, 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'รหัสผ่านทั้งสองช่องไม่ตรงกัน',
    path: ['confirm'],
  });
