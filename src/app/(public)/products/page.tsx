import { Suspense } from 'react';
import { PackageSearch, Search } from 'lucide-react';
import { CatalogFilters } from '@/components/consumer/CatalogFilters';
import { ProductCard } from '@/components/consumer/ProductCard';
import { parseCatalogFilters } from '@/lib/validation/catalog';
import { searchCatalog, sortForDisplay } from '@/lib/queries/catalog';
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
  const [rawProducts, session] = await Promise.all([
    searchCatalog(filters),
    getUserProfile(),
  ]);
  const products = sortForDisplay(rawProducts);
  const canOrder = session?.profile?.role === 'consumer';

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

      <p className="text-sm text-neutral-500">พบ {products.length} รายการ</p>

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
    </div>
  );
}
