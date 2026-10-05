import { createClient } from '@/lib/supabase/server';

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_DAYS = 30;
const CHART_DAYS = 14;
const TOP_PRODUCTS = 5;
const TIME_ZONE = 'Asia/Bangkok';

type DashboardOrder = {
  id: string;
  status: string;
  created_at: string;
  commission_amount: number;
  items: { quantity: number; unit_price: number; product_id: string; product: { name: string } | null }[];
};

export interface PeriodTotals {
  revenue: number;
  completedOrders: number;
  itemsSold: number;
  cancelledOrders: number;
  totalOrders: number;
  /** Platform commission deducted from completed orders. */
  commission: number;
}

export interface StoreCommission {
  /** Current platform rate, 0.10 = 10%. */
  rate: number;
  /** All completed orders, ever. */
  allTimeCommission: number;
  allTimeRevenue: number;
}

export interface DailyRevenue {
  /** YYYY-MM-DD in Bangkok time */
  date: string;
  revenue: number;
  orders: number;
}

export interface StoreDashboardData {
  current: PeriodTotals;
  previous: PeriodTotals;
  daily: DailyRevenue[];
  topProducts: { productId: string; name: string; quantity: number; revenue: number }[];
  openOrders: { pending: number; confirmed: number; ready: number };
  sharedQuantity: number;
  commission: StoreCommission;
}

/** Calendar date in Bangkok for a timestamp, as YYYY-MM-DD. */
function bangkokDate(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: TIME_ZONE });
}

function orderRevenue(o: DashboardOrder): number {
  return o.items.reduce((sum, i) => sum + i.quantity * Number(i.unit_price), 0);
}

function totals(orders: DashboardOrder[]): PeriodTotals {
  const completed = orders.filter((o) => o.status === 'completed');
  return {
    revenue: completed.reduce((sum, o) => sum + orderRevenue(o), 0),
    completedOrders: completed.length,
    itemsSold: completed.reduce(
      (sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0),
      0
    ),
    cancelledOrders: orders.filter((o) => o.status === 'cancelled').length,
    totalOrders: orders.length,
    commission: completed.reduce((sum, o) => sum + Number(o.commission_amount ?? 0), 0),
  };
}

/**
 * Sales figures for the store overview: last 30 days vs the 30 before,
 * 14-day daily revenue, best sellers, and open orders needing action.
 * Revenue counts item value of completed orders only (delivery fees excluded).
 */
export async function getStoreDashboardData(storeId: string): Promise<StoreDashboardData> {
  const supabase = createClient();
  const now = Date.now();
  const periodStart = new Date(now - PERIOD_DAYS * DAY_MS);
  const previousStart = new Date(now - 2 * PERIOD_DAYS * DAY_MS);

  const [ordersRes, openRes, sharesRes, allTimeRes, rateRes] = await Promise.all([
    supabase
      .from('orders')
      .select(
        'id, status, created_at, commission_amount, items:order_items(quantity, unit_price, product_id, product:products(name))'
      )
      .eq('store_id', storeId)
      .gte('created_at', previousStart.toISOString())
      .returns<DashboardOrder[]>(),
    supabase
      .from('orders')
      .select('status')
      .eq('store_id', storeId)
      .in('status', ['pending', 'confirmed', 'ready']),
    supabase
      .from('shares')
      .select('quantity')
      .eq('store_id', storeId)
      .gte('created_at', periodStart.toISOString()),
    supabase
      .from('orders')
      .select('total_amount, delivery_fee, commission_amount')
      .eq('store_id', storeId)
      .eq('status', 'completed'),
    supabase.from('platform_settings').select('commission_rate').maybeSingle(),
  ]);

  const allTime = allTimeRes.data ?? [];
  const commission: StoreCommission = {
    rate: Number(rateRes.data?.commission_rate ?? 0.1),
    allTimeCommission: allTime.reduce((sum, o) => sum + Number(o.commission_amount ?? 0), 0),
    allTimeRevenue: allTime.reduce(
      (sum, o) => sum + Number(o.total_amount) - Number(o.delivery_fee),
      0
    ),
  };

  const orders = (ordersRes.data ?? []).map((o) => ({ ...o, items: o.items ?? [] }));
  const current = orders.filter((o) => new Date(o.created_at) >= periodStart);
  const previous = orders.filter((o) => new Date(o.created_at) < periodStart);

  // Daily revenue, oldest -> newest, every day present even with no sales.
  const byDay = new Map<string, DailyRevenue>();
  for (let i = CHART_DAYS - 1; i >= 0; i--) {
    const date = bangkokDate(new Date(now - i * DAY_MS));
    byDay.set(date, { date, revenue: 0, orders: 0 });
  }
  for (const o of current) {
    if (o.status !== 'completed') continue;
    const day = byDay.get(bangkokDate(new Date(o.created_at)));
    if (day) {
      day.revenue += orderRevenue(o);
      day.orders += 1;
    }
  }

  const productTotals = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const o of current) {
    if (o.status !== 'completed') continue;
    for (const item of o.items) {
      const entry = productTotals.get(item.product_id) ?? {
        name: item.product?.name ?? 'สินค้า',
        quantity: 0,
        revenue: 0,
      };
      entry.quantity += item.quantity;
      entry.revenue += item.quantity * Number(item.unit_price);
      productTotals.set(item.product_id, entry);
    }
  }
  const topProducts = Array.from(productTotals, ([productId, v]) => ({ productId, ...v }))
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, TOP_PRODUCTS);

  const open = { pending: 0, confirmed: 0, ready: 0 };
  for (const row of openRes.data ?? []) {
    if (row.status in open) open[row.status as keyof typeof open] += 1;
  }

  return {
    current: totals(current),
    previous: totals(previous),
    daily: Array.from(byDay.values()),
    topProducts,
    openOrders: open,
    sharedQuantity: (sharesRes.data ?? []).reduce((sum, s) => sum + s.quantity, 0),
    commission,
  };
}
