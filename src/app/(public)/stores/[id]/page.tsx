import { notFound } from 'next/navigation';
import { MapPin, Phone, Truck } from 'lucide-react';
import { ProductCard } from '@/components/consumer/ProductCard';
import { StarRating } from '@/components/shared/StarRating';
import { StoreLogo } from '@/components/shared/StoreLogo';
import { getPublicStore, getStorePublicProducts, sortForDisplay } from '@/lib/queries/catalog';
import type { CatalogProduct } from '@/lib/queries/catalog';
import { getUserProfile } from '@/lib/actions/auth';
import { getStoreRatingSummary, getStoreReviews } from '@/lib/queries/reviews';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('th-TH', { dateStyle: 'medium' });
}

export default async function StorePublicPage({
  params,
}: {
  params: { id: string };
}) {
  const store = await getPublicStore(params.id);
  if (!store) notFound();

  const [products, session, ratingSummary, reviews] = await Promise.all([
    getStorePublicProducts(store.id),
    getUserProfile(),
    getStoreRatingSummary(store.id),
    getStoreReviews(store.id),
  ]);
  const canOrder = session?.profile?.role === 'consumer';
  const withStore: CatalogProduct[] = sortForDisplay(
    products.map((p) => ({
      ...p,
      store: { id: store.id, name: store.name, address: store.address },
    }))
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-2 border-b border-neutral-200 pb-5">
        <div className="flex items-center gap-3">
          <StoreLogo name={store.name} logoUrl={store.logo_url} size="lg" />
          <h1 className="text-2xl font-bold text-forest-900">{store.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-500">
          <span className="flex items-center gap-1">
            <MapPin className="h-4 w-4" /> {store.address}
          </span>
          <span className="flex items-center gap-1">
            <Phone className="h-4 w-4" /> {store.phone}
          </span>
          <span className="flex items-center gap-1">
            <Truck className="h-4 w-4" />
            {Number(store.delivery_fee) > 0
              ? `ค่าจัดส่ง ฿${Number(store.delivery_fee).toLocaleString()}`
              : 'รับเองที่ร้าน'}
          </span>
        </div>
        {ratingSummary.count > 0 && (
          <div className="flex items-center gap-2">
            <StarRating value={ratingSummary.average} size="sm" />
            <span className="text-sm text-neutral-600">
              {ratingSummary.average.toFixed(1)} ({ratingSummary.count} รีวิว)
            </span>
          </div>
        )}
      </div>

      <p className="text-sm text-neutral-500">สินค้าที่กำลังขาย {withStore.length} รายการ</p>

      {withStore.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center text-sm text-neutral-500">
          ร้านนี้ยังไม่มีสินค้าที่กำลังขาย
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {withStore.map((product) => (
            <ProductCard key={product.id} product={product} canOrder={canOrder} />
          ))}
        </div>
      )}

      {reviews.length > 0 && (
        <div className="space-y-3 border-t border-neutral-200 pt-6">
          <h2 className="text-lg font-bold text-neutral-900">รีวิวจากลูกค้า ({reviews.length})</h2>
          <div className="space-y-3">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-neutral-900">
                    {review.consumer?.full_name ?? 'ลูกค้า'}
                  </span>
                  <span className="text-xs text-neutral-400">{formatDate(review.created_at)}</span>
                </div>
                <StarRating value={review.rating} size="sm" />
                {review.comment && (
                  <p className="mt-1 text-sm text-neutral-600">{review.comment}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
