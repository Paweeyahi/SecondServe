import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/user';
import type { Database } from '@/types/database.types';

type RiderRow = Database['public']['Tables']['riders']['Row'];
type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];

export type { RiderRow };

export interface JobPoolLineItem {
  name: string;
  quantity: number;
  imageUrl: string | null;
}

export type JobPoolItem = OrderRow & {
  store: { name: string; address: string } | null;
  items: JobPoolLineItem[];
};

export type RiderOrderDetail = OrderRow & {
  store: { name: string; address: string; phone: string } | null;
  consumer: { full_name: string; phone: string } | null;
  order_items: (OrderItemRow & { product: { name: string; image_url: string } | null })[];
};

type JobPoolRaw = OrderRow & {
  store: { name: string; address: string } | null;
  order_items: { quantity: number; product: { name: string; image_url: string } | null }[];
};

function toJobPoolItem({ order_items, ...rest }: JobPoolRaw): JobPoolItem {
  return {
    ...rest,
    items: (order_items ?? []).map((oi) => ({
      name: oi.product?.name ?? 'สินค้า',
      quantity: oi.quantity,
      imageUrl: oi.product?.image_url ?? null,
    })),
  };
}

/** The rider row for the currently authenticated user, or null. Cached per request. */
export const getCurrentRider = cache(async (): Promise<RiderRow | null> => {
  const user = await getAuthUser();
  if (!user) return null;

  const supabase = createClient();
  const { data } = await supabase.from('riders').select('*').eq('id', user.id).single();
  return data ?? null;
});

/** Unclaimed, ready delivery orders -- the Job Pool. RLS also gates this to verified riders. */
export async function getJobPool(): Promise<JobPoolItem[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('orders')
    .select(
      '*, store:stores(name, address), order_items(quantity, product:products(name, image_url))'
    )
    .eq('status', 'ready')
    .eq('delivery_type', 'delivery')
    .is('rider_id', null)
    .order('created_at', { ascending: true })
    .returns<JobPoolRaw[]>();

  return (data ?? []).map(toJobPoolItem);
}

/** The rider's one active (claimed, not yet completed) delivery, if any. */
export async function getActiveJob(riderId: string): Promise<JobPoolItem | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('orders')
    .select(
      '*, store:stores(name, address), order_items(quantity, product:products(name, image_url))'
    )
    .eq('rider_id', riderId)
    .in('status', ['rider_assigned', 'picked_up', 'delivering'])
    .maybeSingle()
    .returns<JobPoolRaw>();

  if (!data) return null;
  return toJobPoolItem(data);
}

export const RIDER_JOBS_PAGE_SIZE = 10;

const JOB_SELECT =
  '*, store:stores(name, address), order_items(quantity, product:products(name, image_url))';

/** One page of the Job Pool (oldest first, so long-waiting orders go out first). */
export async function getJobPoolPage(
  page: number
): Promise<{ jobs: JobPoolItem[]; total: number }> {
  const supabase = createClient();
  const from = (page - 1) * RIDER_JOBS_PAGE_SIZE;
  const { data, count } = await supabase
    .from('orders')
    .select(JOB_SELECT, { count: 'exact' })
    .eq('status', 'ready')
    .eq('delivery_type', 'delivery')
    .is('rider_id', null)
    .order('created_at', { ascending: true })
    .range(from, from + RIDER_JOBS_PAGE_SIZE - 1)
    .returns<JobPoolRaw[]>();

  return { jobs: (data ?? []).map(toJobPoolItem), total: count ?? 0 };
}

/** One page of this rider's completed deliveries, newest first. */
export async function getRiderDeliveryHistoryPage(
  riderId: string,
  page: number
): Promise<{ jobs: JobPoolItem[]; total: number }> {
  const supabase = createClient();
  const from = (page - 1) * RIDER_JOBS_PAGE_SIZE;
  const { data, count } = await supabase
    .from('orders')
    .select(JOB_SELECT, { count: 'exact' })
    .eq('rider_id', riderId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .range(from, from + RIDER_JOBS_PAGE_SIZE - 1)
    .returns<JobPoolRaw[]>();

  return { jobs: (data ?? []).map(toJobPoolItem), total: count ?? 0 };
}

/** Total delivery fees this rider has earned across all completed jobs. */
export async function getRiderTotalEarnings(riderId: string): Promise<number> {
  const supabase = createClient();
  const { data } = await supabase
    .from('orders')
    .select('delivery_fee')
    .eq('rider_id', riderId)
    .eq('status', 'completed');

  return (data ?? []).reduce((sum, o) => sum + Number(o.delivery_fee), 0);
}

/** One order's full detail -- RLS restricts this to the rider's own job or the open pool. */
export async function getRiderOrderDetail(orderId: string): Promise<RiderOrderDetail | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('orders')
    .select(
      '*, store:stores(name, address, phone), consumer:profiles!orders_consumer_id_fkey(full_name, phone), order_items(*, product:products(name, image_url))'
    )
    .eq('id', orderId)
    .maybeSingle()
    .returns<RiderOrderDetail>();

  return data ?? null;
}
