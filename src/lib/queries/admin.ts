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
  revenue: number;
  commission: number;
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
  return data as unknown as StoreSalesRow[];
}
