import { Suspense } from 'react';
import { PackageSearch, Search } from 'lucide-react';
import { CatalogFilters } from '@/components/consumer/CatalogFilters';
import { ProductCard } from '@/components/consumer/ProductCard';
import { parseCatalogFilters } from '@/lib/validation/catalog';
import { CATALOG_PAGE_SIZE, searchCatalog } from '@/lib/queries/catalog';
import { Pagination, parsePage } from '@/components/ui/Pagination';
import { getUserProfile } from '@/lib/actions/auth';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata = {
  title: 'ค้นหาสินค้าใกล้หมดอายุ — SecondServe',
};

// Catalog results depend entirely on the URL query — never serve a cached copy.
export const dynamic = 'force-dynamic';

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = parseCatalogFilters(searchParams);
  const page = parsePage(searchParams.page);
  const [{ products, total }, session] = await Promise.all([
    searchCatalog(filters, { page }),
    getUserProfile(),
  ]);
  const canOrder = session?.profile?.role === 'consumer';

  // Page links keep every current filter and only swap `page`.
  const hrefForPage = (p: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      const v = Array.isArray(value) ? value[0] : value;
      if (v && key !== 'page') params.set(key, v);
    }
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return qs ? `/products?${qs}` : '/products';
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        icon={Search}
        title="ค้นหาสินค้าใกล้หมดอายุ"
        subtitle="ของดีราคาประหยัดจากร้านค้าในเครือข่าย ช่วยลดขยะอาหาร"
      />

      <Suspense fallback={<div className="h-40 rounded-2xl bg-neutral-100" />}>
        <CatalogFilters />
      </Suspense>

      <p className="text-sm text-neutral-500">พบ {total.toLocaleString()} รายการ</p>

      {products.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
          <PackageSearch className="h-10 w-10 text-neutral-300" />
          <p className="text-sm text-neutral-500">
            ไม่พบสินค้าตามเงื่อนไข ลองปรับตัวกรองหรือล้างการค้นหา
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} canOrder={canOrder} />
          ))}
        </div>
      )}

      {total > 0 && (
        <Pagination
          page={page}
          pageSize={CATALOG_PAGE_SIZE}
          total={total}
          unit="รายการ"
          hrefForPage={hrefForPage}
        />
      )}
    </div>
  );
}
