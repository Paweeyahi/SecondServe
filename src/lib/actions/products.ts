'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentStore, getStoreProduct } from '@/lib/queries/store';
import { firstIssueMessage } from '@/lib/validation/auth';
import {
  ProductCreateSchema,
  ProductUpdateSchema,
  ProductStatusSchema,
} from '@/lib/validation/product';

export interface ActionResult {
  error?: string;
  success?: boolean;
}

const BUCKET = 'products';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function parseProductFields(formData: FormData) {
  return {
    name: formData.get('name'),
    category: formData.get('category'),
    original_price: formData.get('original_price'),
    discount_price: formData.get('discount_price'),
    quantity: formData.get('quantity'),
    expiry_date: formData.get('expiry_date'),
  };
}

async function uploadImage(
  storeId: string,
  file: File
): Promise<{ url?: string; path?: string; error?: string }> {
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: 'ไฟล์รูปต้องมีขนาดไม่เกิน 5MB' };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { error: 'รองรับเฉพาะไฟล์รูป JPG, PNG หรือ WebP' };
  }

  const supabase = createClient();
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${storeId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) return { error: `อัปโหลดรูปไม่สำเร็จ: ${error.message}` };

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

/** Storage path segment of a public product image URL, for cleanup. */
function storagePathFromUrl(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

async function removeImage(path: string) {
  const supabase = createClient();
  await supabase.storage.from(BUCKET).remove([path]);
}

/** Create a near-expiry product for the authenticated store. */
export async function createProduct(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const store = await getCurrentStore();
  if (!store) return { error: 'ไม่พบร้านค้าของคุณ กรุณาเข้าสู่ระบบด้วยบัญชีร้านค้า' };

  const parsed = ProductCreateSchema.safeParse(parseProductFields(formData));
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const image = formData.get('image');
  if (!(image instanceof File) || image.size === 0) {
    return { error: 'กรุณาอัปโหลดรูปสินค้า' };
  }

  const uploaded = await uploadImage(store.id, image);
  if (uploaded.error || !uploaded.url) return { error: uploaded.error };

  const supabase = createClient();
  const { error } = await supabase.from('products').insert({
    store_id: store.id,
    name: parsed.data.name,
    category: parsed.data.category,
    original_price: parsed.data.original_price,
    discount_price: parsed.data.discount_price,
    quantity: parsed.data.quantity,
    expiry_date: parsed.data.expiry_date.toISOString(),
    image_url: uploaded.url,
    status: 'active',
  });

  if (error) {
    if (uploaded.path) await removeImage(uploaded.path);
    return { error: `เพิ่มสินค้าไม่สำเร็จ: ${error.message}` };
  }

  revalidatePath('/dashboard/store/products');
  revalidatePath('/dashboard/store');
  redirect('/dashboard/store/products');
}

/** Update an existing product; recomputes active/sold_out from quantity. */
export async function updateProduct(
  productId: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const store = await getCurrentStore();
  if (!store) return { error: 'ไม่พบร้านค้าของคุณ' };

  const existing = await getStoreProduct(store.id, productId);
  if (!existing) return { error: 'ไม่พบสินค้านี้' };

  const parsed = ProductUpdateSchema.safeParse(parseProductFields(formData));
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  // The value quantity had when this edit form was rendered -- carried
  // through as a hidden field so update_product() can detect whether a
  // sale changed stock underneath the store owner while they were editing.
  const expectedQuantity = Number(formData.get('expected_quantity'));
  if (!Number.isInteger(expectedQuantity) || expectedQuantity < 0) {
    return { error: 'ข้อมูลไม่ถูกต้อง กรุณาลองใหม่' };
  }

  let imageUrl = existing.image_url;
  let oldPath: string | null = null;

  const image = formData.get('image');
  if (image instanceof File && image.size > 0) {
    const uploaded = await uploadImage(store.id, image);
    if (uploaded.error || !uploaded.url) return { error: uploaded.error };
    imageUrl = uploaded.url;
    oldPath = storagePathFromUrl(existing.image_url);
  }

  const supabase = createClient();
  const { error } = await supabase.rpc('update_product', {
    p_product_id: productId,
    p_name: parsed.data.name,
    p_category: parsed.data.category,
    p_original_price: parsed.data.original_price,
    p_discount_price: parsed.data.discount_price,
    p_quantity: parsed.data.quantity,
    p_expiry_date: parsed.data.expiry_date.toISOString(),
    p_image_url: imageUrl,
    p_expected_quantity: expectedQuantity,
  });

  if (error) {
    if (error.message === 'QUANTITY_CHANGED') {
      return {
        error:
          'จำนวนสินค้าคงเหลือมีการเปลี่ยนแปลงจากคำสั่งซื้อใหม่ระหว่างที่คุณแก้ไขอยู่ กรุณาโหลดหน้านี้ใหม่แล้วลองอีกครั้ง',
      };
    }
    return { error: `บันทึกไม่สำเร็จ: ${error.message}` };
  }

  if (oldPath) await removeImage(oldPath);

  revalidatePath('/dashboard/store/products');
  revalidatePath('/dashboard/store');
  redirect('/dashboard/store/products');
}

/** Delete a product and its image. */
export async function deleteProduct(productId: string): Promise<ActionResult> {
  const store = await getCurrentStore();
  if (!store) return { error: 'ไม่พบร้านค้าของคุณ' };

  const existing = await getStoreProduct(store.id, productId);
  if (!existing) return { error: 'ไม่พบสินค้านี้' };

  const supabase = createClient();
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('store_id', store.id);

  if (error) return { error: `ลบไม่สำเร็จ: ${error.message}` };

  const path = storagePathFromUrl(existing.image_url);
  if (path) await removeImage(path);

  revalidatePath('/dashboard/store/products');
  revalidatePath('/dashboard/store');
  return { success: true };
}

/** Explicitly set a product's status (guarded to the owning store). */
export async function setProductStatus(
  productId: string,
  status: string
): Promise<ActionResult> {
  const store = await getCurrentStore();
  if (!store) return { error: 'ไม่พบร้านค้าของคุณ' };

  const parsed = ProductStatusSchema.safeParse(status);
  if (!parsed.success) return { error: 'สถานะไม่ถูกต้อง' };

  const supabase = createClient();
  const { error } = await supabase
    .from('products')
    .update({ status: parsed.data })
    .eq('id', productId)
    .eq('store_id', store.id);

  if (error) return { error: `อัปเดตสถานะไม่สำเร็จ: ${error.message}` };

  revalidatePath('/dashboard/store/products');
  return { success: true };
}
