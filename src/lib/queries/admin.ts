import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database.types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type StoreRow = Database['public']['Tables']['stores']['Row'];
type RiderRow = Database['public']['Tables']['riders']['Row'];

export type AdminUserRow = ProfileRow & { email: string | null };
export type AdminStoreRow = StoreRow & { owner: { full_name: string } | null };
export type AdminRiderRow = RiderRow & { profile: { full_name: string; phone: string } | null };

export interface PlatformMetrics {
  stores_total: number;
  stores_verified: number;
  riders_total: number;
  riders_verified: number;
  consumers_total: number;
  users_suspended: number;
  orders_by_status: Record<string, number>;
  shares_quantity_total: number;
  delivered_items_quantity_total: number;
}

export interface StoreSalesRow {
  store_id: string;
  store_name: string;
  quantity_sold: number;
  /** Completed orders. */
  orders: number;
  /** Item value of completed orders (delivery fees excluded). */
  revenue: number;
  /** Commission deducted from those orders, at each order's own rate. */
  commission: number;
  /** revenue - commission. */
  net: number;
}

export interface CommissionSummary {
  /** Current platform rate, 0.10 = 10%. */
  rate: number;
  completed_orders: number;
  gross: number;
  commission_total: number;
  net_to_stores: number;
  commission_30d: number;
  gross_30d: number;
}

/** Every user (incl. email from auth.users) via admin_list_users() -- admin-only RPC. */
export async function getAllUsers(): Promise<AdminUserRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('admin_list_users');
  if (error || !data) return [];
  return data as unknown as AdminUserRow[];
}

/** Every store with its owner's name -- RLS restricts stores to no one in particular (public read). */
export async function getAllStores(): Promise<AdminStoreRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('stores')
    .select('*, owner:profiles!stores_owner_id_fkey(full_name)')
    .order('created_at', { ascending: false })
    .returns<AdminStoreRow[]>();

  return data ?? [];
}

/** Every rider with their profile name/phone -- RLS restricts this to admins. */
export async function getAllRiders(): Promise<AdminRiderRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('riders')
    .select('*, profile:profiles!riders_id_fkey(full_name, phone)')
    .order('created_at', { ascending: false })
    .returns<AdminRiderRow[]>();

  return data ?? [];
}

/** Aggregate platform metrics via the admin_platform_metrics() RPC. */
export async function getPlatformMetrics(): Promise<PlatformMetrics | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('admin_platform_metrics');
  if (error || !data) return null;
  return data as unknown as PlatformMetrics;
}

/** Per-store revenue + commission from completed orders, via admin_store_sales_report(). */
export async function getStoreSalesReport(): Promise<StoreSalesRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('admin_store_sales_report');
  if (error || !data) return [];
  // numeric columns arrive as JSON numbers or strings depending on scale
  return (data as unknown as StoreSalesRow[]).map((r) => ({
    ...r,
    orders: Number(r.orders ?? 0),
    revenue: Number(r.revenue),
    commission: Number(r.commission),
    net: Number(r.net ?? Number(r.revenue) - Number(r.commission)),
  }));
}

/** Platform-wide commission totals via admin_commission_summary(). */
export async function getCommissionSummary(): Promise<CommissionSummary | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('admin_commission_summary');
  if (error || !data) return null;
  const d = data as Record<string, number | string | null>;
  const num = (k: string) => Number(d[k] ?? 0);
  return {
    rate: num('rate'),
    completed_orders: num('completed_orders'),
    gross: num('gross'),
    commission_total: num('commission_total'),
    net_to_stores: num('net_to_stores'),
    commission_30d: num('commission_30d'),
    gross_30d: num('gross_30d'),
  };
}

export interface DonationOverview {
  claims: { reserved: number; collected: number; cancelled: number; timedOut: number };
  topStores: { storeId: string; name: string; quantity: number; donations: number }[];
}

/**
 * Admin-only donation figures not covered by the public community stats:
 * claim outcomes (share_claims is readable by admins via
 * share_claims_select_related) and the most generous stores.
 */
export async function getDonationOverview(): Promise<DonationOverview> {
  const supabase = createClient();
  const [claimsRes, sharesRes] = await Promise.all([
    supabase.from('share_claims').select('status, cancel_reason, quantity'),
    supabase
      .from('shares')
      .select('store_id, quantity, store:stores(name)')
      .returns<{ store_id: string; quantity: number; store: { name: string } | null }[]>(),
  ]);

  const claims = { reserved: 0, collected: 0, cancelled: 0, timedOut: 0 };
  for (const c of claimsRes.data ?? []) {
    if (c.status === 'reserved') claims.reserved += c.quantity;
    else if (c.status === 'collected') claims.collected += c.quantity;
    else {
      claims.cancelled += c.quantity;
      if (c.cancel_reason === 'timeout') claims.timedOut += c.quantity;
    }
  }

  const byStore = new Map<string, { name: string; quantity: number; donations: number }>();
  for (const s of sharesRes.data ?? []) {
    const entry = byStore.get(s.store_id) ?? { name: s.store?.name ?? 'ร้านค้า', quantity: 0, donations: 0 };
    entry.quantity += s.quantity;
    entry.donations += 1;
    byStore.set(s.store_id, entry);
  }
  const topStores = Array.from(byStore, ([storeId, v]) => ({ storeId, ...v }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  return { claims, topStores };
}
