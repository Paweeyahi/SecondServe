import { PRODUCT_CATEGORY_KEYS, type ProductCategory } from '@/types/product';

export type ExpiryWindow = 'today' | '3days' | 'week';
export type CatalogSort = 'expiry' | 'price' | 'newest' | 'distance';

export interface CatalogFilters {
  q: string;
  category: ProductCategory | null;
  minPrice: number | null;
  maxPrice: number | null;
  exp: ExpiryWindow | null;
  sort: CatalogSort;
  /** Visitor's location, present only when sorting by distance. */
  near: { lat: number; lng: number } | null;
}

/** Non-negative number, or null for empty/invalid input. */
function parsePrice(v: string): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Parse raw `searchParams` (all strings) into typed catalog filters.
 * Invalid values are dropped rather than erroring — the catalog always renders.
 */
export function parseCatalogFilters(
  sp: Record<string, string | string[] | undefined>
): CatalogFilters {
  const one = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v)?.trim() || '';

  const category = one(sp.category);
  const exp = one(sp.exp);
  const sort = one(sp.sort);
  const lat = Number(one(sp.lat));
  const lng = Number(one(sp.lng));
  const near =
    one(sp.lat) && one(sp.lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      ? { lat, lng }
      : null;

  return {
    q: one(sp.q).slice(0, 80),
    category: (PRODUCT_CATEGORY_KEYS as string[]).includes(category)
      ? (category as ProductCategory)
      : null,
    minPrice: parsePrice(one(sp.minPrice)),
    maxPrice: parsePrice(one(sp.maxPrice)),
    exp: (['today', '3days', 'week'] as string[]).includes(exp)
      ? (exp as ExpiryWindow)
      : null,
    // Distance sort needs a location; without one fall back to the default.
    sort:
      sort === 'distance'
        ? near
          ? 'distance'
          : 'expiry'
        : (['expiry', 'price', 'newest'] as string[]).includes(sort)
          ? (sort as CatalogSort)
          : 'expiry',
    near: sort === 'distance' ? near : null,
  };
}

export const EXPIRY_WINDOW_HOURS: Record<ExpiryWindow, number> = {
  today: 24,
  '3days': 72,
  week: 168,
};
