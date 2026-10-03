import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database.types';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];
type Consumer = { full_name: string; phone: string } | null;

export type StoreOrderListItem = OrderRow & {
  consumer: Consumer;
  item_count: number;
  items: { name: string; quantity: number; imageUrl: string | null }[];
};

export type StoreOrderDetail = OrderRow & {
  consumer: Consumer;
  order_items: (OrderItemRow & {
    product: { name: string; image_url: string } | null;
  })[];
};

type StoreOrderListRaw = OrderRow & {
  consumer: Consumer;
  order_items: { quantity: number; product: { name: string; image_url: string } | null }[];
};

/** Count of orders awaiting store action (new, unconfirmed). */
export async function getPendingOrderCount(storeId: string): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .eq('status', 'pending');

  return count ?? 0;
}

export const STORE_ORDERS_PAGE_SIZE = 10;

/** Tabs on the store orders page, each a set of statuses. */
export const STORE_ORDER_TABS = {
  all: { label: 'ทั้งหมด', statuses: null },
  todo: { label: 'ต้องดำเนินการ', statuses: ['pending', 'confirmed', 'ready'] },
  delivering: { label: 'กำลังจัดส่ง', statuses: ['rider_assigned', 'picked_up', 'delivering'] },
  completed: { label: 'สำเร็จ', statuses: ['completed'] },
  cancelled: { label: 'ยกเลิก', statuses: ['cancelled'] },
} as const satisfies Record<string, { label: string; statuses: readonly string[] | null }>;

export type StoreOrderTab = keyof typeof STORE_ORDER_TABS;

export function parseStoreOrderTab(value: string | undefined): StoreOrderTab {
  return value && value in STORE_ORDER_TABS ? (value as StoreOrderTab) : 'all';
}

/** One page of this store's orders for a tab, newest first, plus the tab's total. */
export async function getStoreOrdersPage(
  storeId: string,
  tab: StoreOrderTab,
  page: number
): Promise<{ orders: StoreOrderListItem[]; total: number }> {
  const supabase = createClient();
  const from = (page - 1) * STORE_ORDERS_PAGE_SIZE;
  const statuses = STORE_ORDER_TABS[tab].statuses;

  let query = supabase
    .from('orders')
    .select(
      '*, consumer:profiles!orders_consumer_id_fkey(full_name, phone), order_items(quantity, product:products(name, image_url))',
      { count: 'exact' }
    )
    .eq('store_id', storeId);
  if (statuses) query = query.in('status', [...statuses]);

  const { data, count } = await query
    .order('created_at', { ascending: false })
    .range(from, from + STORE_ORDERS_PAGE_SIZE - 1)
    .returns<StoreOrderListRaw[]>();

  return {
    orders: (data ?? []).map(({ order_items, ...rest }) => ({
      ...rest,
      item_count: order_items?.length ?? 0,
      items: (order_items ?? []).map((oi) => ({
        name: oi.product?.name ?? 'สินค้า',
        quantity: oi.quantity,
        imageUrl: oi.product?.image_url ?? null,
      })),
    })),
    total: count ?? 0,
  };
}

/** Order count per tab, for the tab badges. */
export async function getStoreOrderTabCounts(
  storeId: string
): Promise<Record<StoreOrderTab, number>> {
  const supabase = createClient();
  const { data } = await supabase.from('orders').select('status').eq('store_id', storeId);
  const rows = data ?? [];

  const counts = {} as Record<StoreOrderTab, number>;
  for (const [tab, { statuses }] of Object.entries(STORE_ORDER_TABS)) {
    counts[tab as StoreOrderTab] = statuses
      ? rows.filter((r) => (statuses as readonly string[]).includes(r.status)).length
      : rows.length;
  }
  return counts;
}

/** One order with its line items, scoped to this store (null if it isn't theirs). */
export async function getStoreOrderDetail(
  storeId: string,
  orderId: string
): Promise<StoreOrderDetail | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('orders')
    .select(
      '*, consumer:profiles!orders_consumer_id_fkey(full_name, phone), order_items(*, product:products(name, image_url))'
    )
    .eq('id', orderId)
    .eq('store_id', storeId)
    .maybeSingle()
    .returns<StoreOrderDetail>();

  return data ?? null;
}
