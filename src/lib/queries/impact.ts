import { createClient } from '@/lib/supabase/server';

/**
 * The signed-in consumer's own impact: pieces bought on completed orders,
 * money saved vs original price, and donated pieces they collected.
 */
export async function getMyImpact(userId: string): Promise<{
  itemsSaved: number;
  moneySaved: number;
  claimsCollected: number;
}> {
  const supabase = createClient();
  const [ordersRes, claimsRes] = await Promise.all([
    supabase
      .from('orders')
      .select('order_items(quantity, unit_price, product:products(original_price))')
      .eq('consumer_id', userId)
      .eq('status', 'completed')
      .returns<
        { order_items: { quantity: number; unit_price: number; product: { original_price: number } | null }[] }[]
      >(),
    supabase
      .from('share_claims')
      .select('quantity')
      .eq('claimer_id', userId)
      .eq('status', 'collected'),
  ]);

  let itemsSaved = 0;
  let moneySaved = 0;
  for (const order of ordersRes.data ?? []) {
    for (const item of order.order_items ?? []) {
      itemsSaved += item.quantity;
      const original = Number(item.product?.original_price ?? item.unit_price);
      moneySaved += Math.max(0, original - Number(item.unit_price)) * item.quantity;
    }
  }
  const claimsCollected = (claimsRes.data ?? []).reduce((sum, c) => sum + c.quantity, 0);

  return { itemsSaved: itemsSaved + claimsCollected, moneySaved, claimsCollected };
}
