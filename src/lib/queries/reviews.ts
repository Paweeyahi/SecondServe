import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database.types';

type ReviewRow = Database['public']['Tables']['reviews']['Row'];

export type StoreReview = ReviewRow & {
  consumer: { full_name: string } | null;
};

export type RiderReview = ReviewRow & {
  consumer: { full_name: string } | null;
};

export interface RatingSummary {
  average: number;
  count: number;
}

const EMPTY_SUMMARY: RatingSummary = { average: 0, count: 0 };

function summarize(ratings: { rating: number }[]): RatingSummary {
  if (ratings.length === 0) return EMPTY_SUMMARY;
  const total = ratings.reduce((sum, r) => sum + r.rating, 0);
  return { average: total / ratings.length, count: ratings.length };
}

/**
 * Attaches each reviewer's display name. Names come from the reviewer_names()
 * RPC, already abbreviated server-side ("สมใจ บ.") -- profiles rows themselves
 * are not public, so a
 * plain `consumer:profiles(...)` embed would come back null for visitors.
 */
async function withReviewerNames(reviews: ReviewRow[]): Promise<StoreReview[]> {
  if (reviews.length === 0) return [];
  const supabase = createClient();
  const ids = Array.from(new Set(reviews.map((r) => r.consumer_id)));
  const { data } = await supabase.rpc('reviewer_names', { p_ids: ids });
  const names = new Map((data ?? []).map((row) => [row.id, row.display_name]));

  return reviews.map((r) => {
    const displayName = names.get(r.consumer_id);
    return { ...r, consumer: displayName ? { full_name: displayName } : null };
  });
}

/** Public reviews for a store, newest first. */
export async function getStoreReviews(storeId: string): Promise<StoreReview[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('reviews')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });

  return withReviewerNames(data ?? []);
}

/** Average rating + review count for a store. */
export async function getStoreRatingSummary(storeId: string): Promise<RatingSummary> {
  const supabase = createClient();
  const { data } = await supabase.from('reviews').select('rating').eq('store_id', storeId);
  return summarize(data ?? []);
}

/** Public reviews for a rider, newest first. */
export async function getRiderReviews(riderId: string): Promise<RiderReview[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('reviews')
    .select('*')
    .eq('rider_id', riderId)
    .order('created_at', { ascending: false });

  return withReviewerNames(data ?? []);
}

/** Average rating + review count for a rider. */
export async function getRiderRatingSummary(riderId: string): Promise<RatingSummary> {
  const supabase = createClient();
  const { data } = await supabase.from('reviews').select('rating').eq('rider_id', riderId);
  return summarize(data ?? []);
}

/** Rating summaries for several riders at once, keyed by rider id. */
export async function getRiderRatingSummaries(
  riderIds: string[]
): Promise<Record<string, RatingSummary>> {
  if (riderIds.length === 0) return {};

  const supabase = createClient();
  const { data } = await supabase
    .from('reviews')
    .select('rider_id, rating')
    .in('rider_id', riderIds);

  const byRider = new Map<string, number[]>();
  for (const row of data ?? []) {
    if (!row.rider_id) continue;
    const list = byRider.get(row.rider_id) ?? [];
    list.push(row.rating);
    byRider.set(row.rider_id, list);
  }

  const result: Record<string, RatingSummary> = {};
  for (const riderId of riderIds) {
    const ratings = byRider.get(riderId) ?? [];
    result[riderId] = summarize(ratings.map((rating) => ({ rating })));
  }
  return result;
}

/** This order's store review and rider review, if either/both exist yet. */
export async function getReviewsForOrder(
  orderId: string
): Promise<{ store: ReviewRow | null; rider: ReviewRow | null }> {
  const supabase = createClient();
  const { data } = await supabase.from('reviews').select('*').eq('order_id', orderId);

  const rows = data ?? [];
  return {
    store: rows.find((r) => r.store_id !== null) ?? null,
    rider: rows.find((r) => r.rider_id !== null) ?? null,
  };
}
