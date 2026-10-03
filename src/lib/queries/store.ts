import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/user';
import type { Database } from '@/types/database.types';

export type StoreRow = Database['public']['Tables']['stores']['Row'];
export type ProductRow = Database['public']['Tables']['products']['Row'];

/**
 * The store owned by the currently authenticated user, or null. Cached per
 * request -- the layout and the page both call this, and without caching
 * each call re-verifies the user AND re-queries stores from scratch.
 */
export const getCurrentStore = cache(async (): Promise<StoreRow | null> => {
  const user = await getAuthUser();
  if (!user) return null;

  const supabase = createClient();
  const { data } = await supabase
    .from('stores')
    .select('*')
    .eq('owner_id', user.id)
    .single();

  return data ?? null;
});

/** All products for a store, newest first. */
export async function getStoreProducts(storeId: string): Promise<ProductRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });

  return data ?? [];
}

/** A single product scoped to a store (returns null if it isn't theirs). */
export async function getStoreProduct(
  storeId: string,
  productId: string
): Promise<ProductRow | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('store_id', storeId)
    .single();

  return data ?? null;
}
