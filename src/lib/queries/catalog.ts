import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database.types';
import {
  type CatalogFilters,
  EXPIRY_WINDOW_HOURS,
} from '@/lib/validation/catalog';

type ProductRow = Database['public']['Tables']['products']['Row'];
type StoreRow = Database['public']['Tables']['stores']['Row'];

export type CatalogProduct = ProductRow & {
  store:
    | (Pick<StoreRow, 'id' | 'name' | 'address'> &
        Partial<Pick<StoreRow, 'latitude' | 'longitude'>>)
    | null;
  /** Straight-line distance to the visitor, set only when sorting by distance. */
  distanceKm?: number;
};

/** Great-circle distance in km (haversine). */
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const CATALOG_LIMIT = 60;

/**
 * Public catalog search. RLS (`products_select_public`) already restricts rows to
 * active, in-stock products from verified stores; this only applies user filters.
 */
export async function searchCatalog(
  filters: CatalogFilters
): Promise<CatalogProduct[]> {
  const supabase = createClient();

  let query = supabase
    .from('products')
    .select('*, store:stores(id, name, address, latitude, longitude)')
    .limit(CATALOG_LIMIT);

  if (filters.category) query = query.eq('category', filters.category);
  if (filters.minPrice != null) query = query.gte('discount_price', filters.minPrice);
  if (filters.maxPrice != null) query = query.lte('discount_price', filters.maxPrice);

  if (filters.exp) {
    const cutoff = new Date(
      Date.now() + EXPIRY_WINDOW_HOURS[filters.exp] * 3600_000
    ).toISOString();
    query = query.lte('expiry_date', cutoff);
  }

  if (filters.q) {
    // Direct .ilike() uses %-wildcards; the .or() filter string uses *-wildcards.
    const { data: stores } = await supabase
      .from('stores')
      .select('id')
      .ilike('name', `%${filters.q}%`);
    const storeIds = (stores ?? []).map((s) => s.id);

    query =
      storeIds.length > 0
        ? query.or(`name.ilike.*${filters.q}*,store_id.in.(${storeIds.join(',')})`)
        : query.ilike('name', `%${filters.q}%`);
  }

  if (filters.sort === 'price') query = query.order('discount_price', { ascending: true });
  else if (filters.sort === 'newest') query = query.order('created_at', { ascending: false });
  else query = query.order('expiry_date', { ascending: true });

  const { data, error } = await query;
  if (error) console.error('[searchCatalog]', error);
  const products = (data as CatalogProduct[] | null) ?? [];

  const near = filters.near;
  if (filters.sort === 'distance' && near) {
    // Distance is computed in app code (no PostGIS); the query above already
    // capped the set at CATALOG_LIMIT soonest-expiring items.
    return products
      .map((p) => ({
        ...p,
        distanceKm:
          p.store?.latitude != null && p.store?.longitude != null
            ? distanceKm(near, { lat: Number(p.store.latitude), lng: Number(p.store.longitude) })
            : undefined,
      }))
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  }
  return products;
}

/**
 * Reorders a product list for browsing: purchasable items (active, in stock,
 * not expired) first in their existing order, then unpurchasable ones with the
 * most-recently-expired first and the oldest pushed to the very end.
 */
export function sortForDisplay<
  T extends { status: string; quantity: number; expiry_date: string },
>(products: T[]): T[] {
  const isAvailable = (p: T) =>
    p.status === 'active' && p.quantity > 0 && new Date(p.expiry_date).getTime() > Date.now();

  const available = products.filter(isAvailable);
  const unavailable = products
    .filter((p) => !isAvailable(p))
    .sort((a, b) => new Date(b.expiry_date).getTime() - new Date(a.expiry_date).getTime());

  return [...available, ...unavailable];
}

export type ProductDetail = ProductRow & {
  store: Pick<StoreRow, 'id' | 'name' | 'address' | 'phone' | 'delivery_fee' | 'verified'> | null;
};

/**
 * One product for its detail page. RLS decides visibility: anyone sees an
 * active, unexpired product of a verified store; owners/past buyers may also
 * see it after it sells out (the page then shows it as unavailable).
 */
export async function getProductDetail(productId: string): Promise<ProductDetail | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('products')
    .select('*, store:stores(id, name, address, phone, delivery_fee, verified)')
    .eq('id', productId)
    .maybeSingle()
    .returns<ProductDetail>();
  if (error) console.error('[getProductDetail]', error);
  return data ?? null;
}

/** A single verified store's public profile, or null. */
export async function getPublicStore(storeId: string): Promise<StoreRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('id', storeId)
    .eq('verified', true)
    .maybeSingle();
  if (error) console.error('[getPublicStore]', error);
  return data ?? null;
}

/** Public (active, in-stock) products for one store. */
export async function getStorePublicProducts(
  storeId: string
): Promise<ProductRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('store_id', storeId)
    .eq('status', 'active')
    .gt('quantity', 0)
    .order('expiry_date', { ascending: true });
  return data ?? [];
}
