import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/user';
import type { Database } from '@/types/database.types';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];

export type OrderListItem = OrderRow & {
  store: { id: string; name: string } | null;
  item_count: number;
};

export type OrderDetail = OrderRow & {
  store: { id: string; name: string; address: string; phone: string } | null;
  order_items: (OrderItemRow & {
    product: { name: string; image_url: string; original_price: number } | null;
  })[];
};

type OrderListRaw = OrderRow & {
  store: { id: string; name: string } | null;
  order_items: { id: string }[];
};

/** Orders belonging to the current consumer, newest first. */
export async function getMyOrders(): Promise<OrderListItem[]> {
  const user = await getAuthUser();
  if (!user) return [];

  const supabase = createClient();

  const { data } = await supabase
    .from('orders')
    .select('*, store:stores(id, name), order_items(id)')
    .eq('consumer_id', user.id)
    .order('created_at', { ascending: false })
    .returns<OrderListRaw[]>();

  return (data ?? []).map(({ order_items, ...rest }) => ({
    ...rest,
    item_count: order_items?.length ?? 0,
  }));
}

/** One order with its line items — RLS restricts this to people related to it. */
export async function getOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('orders')
    .select(
      '*, store:stores(id, name, address, phone), order_items(*, product:products(name, image_url, original_price))'
    )
    .eq('id', orderId)
    .maybeSingle()
    .returns<OrderDetail>();

  return data ?? null;
}
