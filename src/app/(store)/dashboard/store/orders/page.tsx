import Link from 'next/link';
import { Package2 } from 'lucide-react';
import { SectionTitle } from '@/components/ui/PageHeader';
import { Pagination, parsePage } from '@/components/ui/Pagination';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StoreOrdersTable } from '@/components/store/StoreOrdersTable';
import { getCurrentStore } from '@/lib/queries/store';
import {
  STORE_ORDERS_PAGE_SIZE,
  STORE_ORDER_TABS,
  getStoreOrderTabCounts,
  getStoreOrdersPage,
  parseStoreOrderTab,
  type StoreOrderTab,
} from '@/lib/queries/store-orders';

export const dynamic = 'force-dynamic';

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function ordersHref(tab: StoreOrderTab, page = 1): string {
  const params = new URLSearchParams();
  if (tab !== 'all') params.set('status', tab);
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `/dashboard/store/orders?${qs}` : '/dashboard/store/orders';
}

export default async function StoreOrdersPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const store = await getCurrentStore();
  if (!store) return null;

  const tab = parseStoreOrderTab(one(searchParams.status));
  const page = parsePage(searchParams.page);

  const [{ orders, total }, counts] = await Promise.all([
    getStoreOrdersPage(store.id, tab, page),
    getStoreOrderTabCounts(store.id),
  ]);

  return (
    <div className="space-y-4">
      <SectionTitle
        subtitle={`${counts.todo > 0 ? `มี ${counts.todo} ออเดอร์รอดำเนินการ` : 'ไม่มีออเดอร์ค้าง'} · ทั้งหมด ${counts.all} ออเดอร์`}
      >
        ออเดอร์
      </SectionTitle>

      {/* Status tabs */}
      <nav className="flex gap-1 overflow-x-auto rounded-xl bg-neutral-100 p-1" aria-label="กรองตามสถานะ">
        {(Object.keys(STORE_ORDER_TABS) as StoreOrderTab[]).map((key) => {
          const active = key === tab;
          const highlight = key === 'todo' && counts.todo > 0;
          return (
            <Link
              key={key}
              href={ordersHref(key)}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-forest-800 text-white shadow-sm'
                  : 'text-neutral-600 hover:bg-white hover:text-forest-800'
              }`}
            >
              {STORE_ORDER_TABS[key].label}
              <span
                className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                  highlight
                    ? 'bg-red-500 text-white'
                    : active
                      ? 'bg-white/20 text-white'
                      : 'bg-neutral-200 text-neutral-600'
                }`}
              >
                {counts[key]}
              </span>
            </Link>
          );
        })}
      </nav>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <Package2 className="h-10 w-10 text-neutral-300" />
            <p className="text-sm text-neutral-500">
              {tab === 'all' ? 'ยังไม่มีคำสั่งซื้อเข้ามา' : 'ไม่มีออเดอร์ในสถานะนี้'}
            </p>
            {page > 1 && (
              <Link href={ordersHref(tab)}>
                <Button variant="outline" size="sm">
                  กลับไปหน้าแรก
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <StoreOrdersTable orders={orders} />

          <Pagination
            page={page}
            pageSize={STORE_ORDERS_PAGE_SIZE}
            total={total}
            unit="ออเดอร์"
            hrefForPage={(p) => ordersHref(tab, p)}
          />
        </>
      )}
    </div>
  );
}
