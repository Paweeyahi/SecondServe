'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/user';
import {
  SignInSchema,
  SignUpSchema,
  firstIssueMessage,
} from '@/lib/validation/auth';
import type { UserRole } from '@/types/roles';

export interface AuthActionResult {
  error?: string;
  success?: boolean;
}

const CONNECTION_HINT =
  'ไม่สามารถเชื่อมต่อ Supabase ได้ กรุณาตรวจสอบ NEXT_PUBLIC_SUPABASE_URL และ KEY ในไฟล์ .env.local';

/** Landing route for a given role. */
function roleDestination(role: UserRole): string {
  switch (role) {
    case 'store':
      return '/dashboard/store';
    case 'rider':
      return '/dashboard/rider';
    case 'admin':
      return '/dashboard/admin';
    default:
      return '/';
  }
}

/**
 * Sign in with email + password, then redirect based on role.
 * Suspended accounts are rejected and signed out.
 */
export async function signIn(
  _prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = SignInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }

  const supabase = createClient();

  const { data: authData, error: signInError } =
    await supabase.auth.signInWithPassword(parsed.data);

  if (signInError || !authData.user) {
    const msg = signInError?.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
    if (msg.includes('fetch failed')) return { error: CONNECTION_HINT };
    if (msg.toLowerCase().includes('invalid login credentials')) {
      return { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
    }
    return { error: msg };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, suspended')
    .eq('id', authData.user.id)
    .single();

  if (profile?.suspended) {
    await supabase.auth.signOut();
    return { error: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ' };
  }

  const role = (profile?.role as UserRole) ?? 'consumer';
  revalidatePath('/', 'layout');
  redirect(safeNextPath(formData.get('next'), role) ?? roleDestination(role));
}

/**
 * The page a user was on before being sent to /login (`?next=`), if it is a
 * same-site path this role may open. Anything else falls back to the role's
 * home -- never an absolute/protocol-relative URL (open-redirect guard).
 */
function safeNextPath(value: FormDataEntryValue | null, role: UserRole): string | null {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  if (value.startsWith('/login') || value.startsWith('/register')) return null;
  const roleOnly: [string, UserRole][] = [
    ['/dashboard/store', 'store'],
    ['/dashboard/rider', 'rider'],
    ['/dashboard/admin', 'admin'],
  ];
  for (const [prefix, owner] of roleOnly) {
    if (value.startsWith(prefix) && role !== owner) return null;
  }
  const consumerOnly = ['/checkout', '/orders', '/claims', '/account'];
  if (role !== 'consumer' && consumerOnly.some((p) => value.startsWith(p))) return null;
  return value;
}

/**
 * Register a new user. A database trigger (handle_new_user) reads the signup
 * metadata and creates the matching public.profiles / stores / riders rows with
 * SECURITY DEFINER, so no client-side inserts are needed.
 */
export async function signUp(
  _prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = SignUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    full_name: formData.get('full_name'),
    phone: formData.get('phone'),
    role: formData.get('role') ?? 'consumer',
    store_name: formData.get('store_name') ?? undefined,
    store_address: formData.get('store_address') ?? undefined,
    vehicle_type: formData.get('vehicle_type') ?? undefined,
    license_plate: formData.get('license_plate') ?? undefined,
  });
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }

  const input = parsed.data;
  const supabase = createClient();

  const metadata: Record<string, string> = {
    full_name: input.full_name,
    phone: input.phone,
    role: input.role,
  };
  if (input.role === 'store') {
    metadata.store_name = input.store_name;
    metadata.store_address = input.store_address;
  } else if (input.role === 'rider') {
    metadata.vehicle_type = input.vehicle_type;
    metadata.license_plate = input.license_plate;
  }

  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: metadata },
  });

  if (signUpError || !authData.user) {
    const msg = signUpError?.message || 'เกิดข้อผิดพลาดในการลงทะเบียนบัญชี';
    if (msg.includes('fetch failed')) return { error: CONNECTION_HINT };
    if (msg.toLowerCase().includes('already registered')) {
      return { error: 'อีเมลนี้ถูกใช้ลงทะเบียนแล้ว' };
    }
    return { error: msg };
  }

  revalidatePath('/', 'layout');

  // Email confirmation enabled → no session yet.
  if (!authData.session) {
    return {
      success: true,
      error: 'สมัครสมาชิกสำเร็จ กรุณายืนยันอีเมลของคุณ แล้วเข้าสู่ระบบอีกครั้ง',
    };
  }

  redirect(roleDestination(input.role));
}

/** Sign out the current user. */
export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

/** Server Component helper: the authenticated user and their profile row. */
export async function getUserProfile() {
  const supabase = createClient();
  const user = await getAuthUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return { user, profile: profile ?? null };
}
