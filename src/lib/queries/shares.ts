import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/user';
import type { Database } from '@/types/database.types';
import type { ShareClaimStatus } from '@/types/share';
import type { ShareFeedFilters } from '@/lib/validation/share';

type ShareRow = Database['public']['Tables']['shares']['Row'];
type ShareClaimRow = Database['public']['Tables']['share_claims']['Row'];

export type StoreShareClaim = Pick<
  ShareClaimRow,
  'id' | 'quantity' | 'status' | 'created_at' | 'resolved_at'
> & {
  claimer: { full_name: string; phone: string } | null;
};

export type StoreShare = ShareRow & {
  product: { name: string; image_url: string; expiry_date: string } | null;
  foundation: { id: string; name: string; address: string | null; phone: string | null } | null;
  claims: StoreShareClaim[];
};

export type PublicShare = ShareRow & {
  product: { name: string; image_url: string; category: string; expiry_date: string } | null;
  store: { id: string; name: string; address: string; verified: boolean } | null;
  foundation: { id: string; name: string } | null;
};

export type MyShareClaim = ShareClaimRow & {
  share: {
    pickup_note: string | null;
    product: { name: string; image_url: string; expiry_date: string } | null;
    store: { id: string; name: string; address: string; phone: string } | null;
  } | null;
};

export interface FoundationStat {
  id: string;
  name: string;
  description: string | null;
  deliveredQuantity: number;
}

export interface CommunityShareStats {
  totalQuantity: number;
  storeCount: number;
  collectedQuantity: number;
  foundationDeliveredQuantity: number;
  availableQuantity: number;
  byCategory: { category: string; quantity: number }[];
  foundations: FoundationStat[];
}

export const PUBLIC_SHARES_PAGE_SIZE = 12;

/** This store's donation log with every claim on it, newest first. */
export async function getStoreShares(storeId: string): Promise<StoreShare[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('shares')
    .select(
      '*, product:products(name, image_url, expiry_date), foundation:foundations(id, name, address, phone), claims:share_claims(id, quantity, status, created_at, resolved_at, claimer:profiles(full_name, phone))'
    )
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .returns<StoreShare[]>();

  return (data ?? []).map((share) => ({
    ...share,
    claims: [...(share.claims ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)),
  }));
}

/** Claims on this store's donations still waiting for hand-over (nav badge). */
export async function getReservedClaimCount(storeId: string): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from('share_claims')
    .select('id, share:shares!inner(store_id)', { count: 'exact', head: true })
    .eq('status', 'reserved')
    .eq('share.store_id', storeId);

  return count ?? 0;
}

/**
 * Public community-donation feed, paginated. `available` shows only what can
 * still be claimed (pieces left, not expired, verified store); `all` is the
 * full history.
 */
export async function getPublicShares(
  filters: ShareFeedFilters
): Promise<{ shares: PublicShare[]; total: number }> {
  const supabase = createClient();
  const from = (filters.page - 1) * PUBLIC_SHARES_PAGE_SIZE;

  let query = supabase
    .from('shares')
    .select(
      '*, product:products!inner(name, image_url, category, expiry_date), store:stores!inner(id, name, address, verified), foundation:foundations(id, name)',
      { count: 'exact' }
    );

  if (filters.view === 'available') {
    query = query
      .gt('remaining', 0)
      .gt('product.expiry_date', new Date().toISOString())
      .eq('store.verified', true);
  }
  if (filters.category) {
    query = query.eq('product.category', filters.category);
  }

  const { data, count } = await query
    .order('created_at', { ascending: false })
    .range(from, from + PUBLIC_SHARES_PAGE_SIZE - 1)
    .returns<PublicShare[]>();

  return { shares: data ?? [], total: count ?? 0 };
}

/** Feed-wide totals (total shared, collected, available now, per category). */
export async function getCommunityShareStats(): Promise<CommunityShareStats> {
  const supabase = createClient();
  const { data } = await supabase.rpc('community_share_stats');
  const raw = (data ?? {}) as {
    total_quantity?: number;
    store_count?: number;
    collected_quantity?: number;
    foundation_delivered_quantity?: number;
    available_quantity?: number;
    by_category?: { category: string; quantity: number }[];
    foundations?: {
      id: string;
      name: string;
      description: string | null;
      delivered_quantity: number;
    }[];
  };

  return {
    totalQuantity: Number(raw.total_quantity ?? 0),
    storeCount: Number(raw.store_count ?? 0),
    collectedQuantity: Number(raw.collected_quantity ?? 0),
    foundationDeliveredQuantity: Number(raw.foundation_delivered_quantity ?? 0),
    availableQuantity: Number(raw.available_quantity ?? 0),
    byCategory: (raw.by_category ?? []).map((c) => ({
      category: c.category,
      quantity: Number(c.quantity),
    })),
    foundations: (raw.foundations ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description,
      deliveredQuantity: Number(f.delivered_quantity),
    })),
  };
}

/** For the signed-in user: share_id -> status of their live claim on it. */
export async function getMyClaimStatusByShare(
  shareIds: string[]
): Promise<Record<string, ShareClaimStatus>> {
  const user = await getAuthUser();
  if (!user || shareIds.length === 0) return {};

  const supabase = createClient();
  const { data } = await supabase
    .from('share_claims')
    .select('share_id, status')
    .eq('claimer_id', user.id)
    .neq('status', 'cancelled')
    .in('share_id', shareIds);

  return Object.fromEntries((data ?? []).map((c) => [c.share_id, c.status]));
}

/** The signed-in consumer's donation claims, newest first. */
export async function getMyShareClaims(): Promise<MyShareClaim[]> {
  const user = await getAuthUser();
  if (!user) return [];

  const supabase = createClient();
  const { data } = await supabase
    .from('share_claims')
    .select(
      '*, share:shares(pickup_note, product:products(name, image_url, expiry_date), store:stores(id, name, address, phone))'
    )
    .eq('claimer_id', user.id)
    .order('created_at', { ascending: false })
    .returns<MyShareClaim[]>();

  return data ?? [];
}
