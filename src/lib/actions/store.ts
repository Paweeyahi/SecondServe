'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/user';
import { StoreProfileSchema } from '@/lib/validation/store';
import { firstIssueMessage } from '@/lib/validation/auth';
import { getCurrentStore } from '@/lib/queries/store';

export interface ActionResult {
  error?: string;
  success?: boolean;
}

/** Update the authenticated store owner's profile (name, address, fee, coords). */
export async function updateStoreProfile(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = StoreProfileSchema.safeParse({
    name: formData.get('name'),
    address: formData.get('address'),
    phone: formData.get('phone'),
    latitude: formData.get('latitude'),
    longitude: formData.get('longitude'),
    delivery_fee: formData.get('delivery_fee'),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const user = await getAuthUser();
  if (!user) return { error: 'กรุณาเข้าสู่ระบบ' };

  const supabase = createClient();
  const { data, error } = await supabase
    .from('stores')
    .update(parsed.data)
    .eq('owner_id', user.id)
    .select('id');

  if (error) return { error: `บันทึกไม่สำเร็จ: ${error.message}` };
  if (!data || data.length === 0) {
    return { error: 'ไม่พบร้านค้าของคุณ หรือไม่มีสิทธิ์แก้ไข (ตรวจสอบ RLS policy ของตาราง stores)' };
  }

  revalidatePath('/dashboard/store', 'layout');
  return { success: true };
}

const LOGO_BUCKET = 'products';
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Storage path inside the bucket for a public object URL, or null. */
function logoPathFromUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = `/object/public/${LOGO_BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

function revalidateStorePages(storeId: string) {
  revalidatePath('/dashboard/store', 'layout');
  revalidatePath(`/stores/${storeId}`);
  revalidatePath('/products');
  revalidatePath('/');
}

/**
 * Upload / replace the store's logo. The file goes in the store's own
 * products/<store_id>/ folder -- the only folder storage RLS lets it write.
 */
export async function uploadStoreLogo(formData: FormData): Promise<ActionResult> {
  const file = formData.get('logo');
  if (!(file instanceof File) || file.size === 0) return { error: 'กรุณาเลือกไฟล์รูป' };
  if (file.size > MAX_LOGO_BYTES) return { error: 'ไฟล์โลโก้ต้องมีขนาดไม่เกิน 2MB' };
  if (!LOGO_TYPES.includes(file.type)) return { error: 'รองรับเฉพาะไฟล์รูป JPG, PNG หรือ WebP' };

  const store = await getCurrentStore();
  if (!store) return { error: 'ไม่พบร้านค้าของคุณ' };

  const supabase = createClient();
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const path = `${store.id}/logo-${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return { error: `อัปโหลดโลโก้ไม่สำเร็จ: ${uploadError.message}` };

  const { data: pub } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  const { error } = await supabase.from('stores').update({ logo_url: pub.publicUrl }).eq('id', store.id);
  if (error) {
    await supabase.storage.from(LOGO_BUCKET).remove([path]);
    return { error: `บันทึกโลโก้ไม่สำเร็จ: ${error.message}` };
  }

  const oldPath = logoPathFromUrl(store.logo_url);
  if (oldPath) await supabase.storage.from(LOGO_BUCKET).remove([oldPath]);

  revalidateStorePages(store.id);
  return { success: true };
}

/** Remove the store's logo (falls back to the name-initial avatar). */
export async function removeStoreLogo(): Promise<ActionResult> {
  const store = await getCurrentStore();
  if (!store) return { error: 'ไม่พบร้านค้าของคุณ' };

  const supabase = createClient();
  const { error } = await supabase.from('stores').update({ logo_url: null }).eq('id', store.id);
  if (error) return { error: `ลบโลโก้ไม่สำเร็จ: ${error.message}` };

  const oldPath = logoPathFromUrl(store.logo_url);
  if (oldPath) await supabase.storage.from(LOGO_BUCKET).remove([oldPath]);

  revalidateStorePages(store.id);
  return { success: true };
}
