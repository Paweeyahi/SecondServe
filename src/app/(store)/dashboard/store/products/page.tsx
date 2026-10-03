import Link from 'next/link';
import { Package, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { StoreProductCard } from '@/components/store/StoreProductCard';
import { getCurrentStore, getStoreProducts } from '@/lib/queries/store';
import { getActiveFoundations } from '@/lib/queries/foundations';
import { SectionTitle } from '@/components/ui/PageHeader';

export default async function StoreProductsPage() {
  const store = await getCurrentStore();
  const [products, foundations] = await Promise.all([
    store ? getStoreProducts(store.id) : Promise.resolve([]),
    getActiveFoundations(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionTitle>สินค้าทั้งหมด ({products.length})</SectionTitle>
        <Link href="/dashboard/store/products/new">
          <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />}>
            เพิ่มสินค้า
          </Button>
        </Link>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <Package className="h-10 w-10 text-neutral-300" />
            <p className="text-sm text-neutral-500">ยังไม่มีสินค้า เริ่มเพิ่มสินค้าใกล้หมดอายุชิ้นแรกของคุณ</p>
            <Link href="/dashboard/store/products/new">
              <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
                เพิ่มสินค้าใหม่
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {products.map((product) => (
            <StoreProductCard key={product.id} product={product} foundations={foundations} />
          ))}
        </div>
      )}
    </div>
  );
}
