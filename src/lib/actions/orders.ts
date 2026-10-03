'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { CreateOrderSchema, type CreateOrderInput } from '@/lib/validation/order';
import { firstIssueMessage } from '@/lib/validation/auth';

export interface CreateOrderResult {
  error?: string;
  orderId?: string;
  /** product ids that ran out of stock, for the client to reconcile the cart */
  outOfStock?: string[];
}

function friendlyRpcError(message: string): {
  error: string;
  outOfStock?: string[];
} {
  if (message.startsWith('OUT_OF_STOCK:')) {
    return {
      error: 'สินค้าบางรายการหมดสต็อกแล้ว กรุณาปรับตะกร้าและลองใหม่',
      outOfStock: [message.split(':')[1]].filter(Boolean),
    };
  }
  const map: Record<string, string> = {
    AUTH_REQUIRED: 'กรุณาเข้าสู่ระบบ',
    CONSUMER_ONLY: 'เฉพาะบัญชีผู้บริโภคเท่านั้นที่สั่งซื้อได้',
    EMPTY_CART: 'ตะกร้าว่างเปล่า',
    STORE_UNAVAILABLE: 'ร้านค้านี้ไม่พร้อมให้บริการ',
    ADDRESS_REQUIRED: 'กรุณากรอกที่อยู่จัดส่ง',
    BAD_DELIVERY_TYPE: 'ประเภทการรับสินค้าไม่ถูกต้อง',
    BAD_QUANTITY: 'จำนวนสินค้าไม่ถูกต้อง',
  };
  return { error: map[message] ?? `สั่งซื้อไม่สำเร็จ: ${message}` };
}

export interface CheckoutStoreInfo {
  id: string;
  name: string;
  address: string;
  deliveryFee: number;
  available: boolean;
}

/** Store details the checkout screen needs (name, delivery fee, availability). */
export async function getCheckoutStoreInfo(
  storeId: string
): Promise<CheckoutStoreInfo | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('stores')
    .select('id, name, address, delivery_fee, verified')
    .eq('id', storeId)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    address: data.address,
    deliveryFee: Number(data.delivery_fee),
    available: data.verified,
  };
}

/** Place an order atomically via the place_order() Postgres function. */
export async function createOrder(
  input: CreateOrderInput
): Promise<CreateOrderResult> {
  const parsed = CreateOrderSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const { storeId, deliveryType, deliveryAddress, items } = parsed.data;
  const supabase = createClient();

  const { data, error } = await supabase.rpc('place_order', {
    p_store_id: storeId,
    p_delivery_type: deliveryType,
    p_delivery_address: deliveryType === 'delivery' ? deliveryAddress : null,
    p_items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
  });

  if (error) return friendlyRpcError(error.message);
  if (!data) return { error: 'สั่งซื้อไม่สำเร็จ กรุณาลองใหม่' };

  revalidatePath('/orders');
  revalidatePath('/products');
  return { orderId: data as string };
}

export interface OrderActionResult {
  error?: string;
  success?: boolean;
}

function friendlyOrderActionError(message: string): string {
  const map: Record<string, string> = {
    AUTH_REQUIRED: 'กรุณาเข้าสู่ระบบ',
    STALE_OR_FORBIDDEN:
      'ไม่สามารถอัปเดตออเดอร์นี้ได้ อาจมีการเปลี่ยนสถานะไปแล้ว หรือไม่ใช่ออเดอร์ของร้านคุณ',
  };
  return map[message] ?? `ดำเนินการไม่สำเร็จ: ${message}`;
}

function revalidateStoreOrder(orderId: string) {
  revalidatePath('/dashboard/store/orders');
  revalidatePath(`/dashboard/store/orders/${orderId}`);
}

/** pending -> confirmed */
export async function confirmOrder(orderId: string): Promise<OrderActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc('confirm_order', { p_order_id: orderId });
  if (error) return { error: friendlyOrderActionError(error.message) };
  revalidateStoreOrder(orderId);
  return { success: true };
}

/** confirmed -> ready */
export async function markReady(orderId: string): Promise<OrderActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc('mark_order_ready', { p_order_id: orderId });
  if (error) return { error: friendlyOrderActionError(error.message) };
  revalidateStoreOrder(orderId);
  return { success: true };
}

/** ready -> completed (pickup only; delivery orders hand off to the rider workflow) */
export async function completePickup(orderId: string): Promise<OrderActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc('complete_pickup_order', { p_order_id: orderId });
  if (error) return { error: friendlyOrderActionError(error.message) };
  revalidateStoreOrder(orderId);
  return { success: true };
}

/** pending/confirmed/ready -> cancelled; restocks every line item atomically (D3) */
export async function cancelOrder(orderId: string): Promise<OrderActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc('cancel_order', { p_order_id: orderId });
  if (error) return { error: friendlyOrderActionError(error.message) };
  revalidateStoreOrder(orderId);
  revalidatePath('/products');
  return { success: true };
}
