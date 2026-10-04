import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CalendarClock,
  ChevronLeft,
  MapPin,
  Package,
  Phone,
  Truck,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { SectionTitle } from '@/components/ui/PageHeader';
import { AddToCartButton } from '@/components/consumer/AddToCartButton';
import { ExpiryBadge } from '@/components/consumer/ExpiryBadge';
import { ProductCard } from '@/components/consumer/ProductCard';
import { StarRating } from '@/components/shared/StarRating';
import { StoreLogo } from '@/components/shared/StoreLogo';
import { categoryLabel } from '@/types/product';
import { getUserProfile } from '@/lib/actions/auth';
import {
  getProductDetail,
  getStorePublicProducts,
  sortForDisplay,
  type CatalogProduct,
} from '@/lib/queries/catalog';
import { getStoreRatingSummary, getStoreReviews } from '@/lib/queries/reviews';

export const dynamic = 'force-dynamic';

const MORE_FROM_STORE = 4;
const REVIEWS_SHOWN = 3;

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const product = await getProductDetail(params.id);
  if (!product) return { title: 'ไม่พบสินค้า — SecondServe' };

  const title = `${product.name} ฿${Number(product.discount_price).toLocaleString()} — SecondServe`;
  const description = `${product.name} จาก ${product.store?.name ?? 'ร้านค้า'} ลดเหลือ ฿${Number(
    product.discount_price
  ).toLocaleString()} (ปกติ ฿${Number(product.original_price).toLocaleString()})`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: product.image_url }] },
  };
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const product = await getProductDetail(params.id);
  if (!product) notFound();

  const store = product.store;
  const [session, rating, reviews, storeProducts] = await Promise.all([
    getUserProfile(),
    store ? getStoreRatingSummary(store.id) : Promise.resolve({ average: 0, count: 0 }),
    store ? getStoreReviews(store.id) : Promise.resolve([]),
    store ? getStorePublicProducts(store.id) : Promise.resolve([]),
  ]);

  const canOrder = session?.profile?.role === 'consumer';
  const price = Number(product.discount_price);
  const original = Number(product.original_price);
  const saving = original - price;
  const discountPct = original > 0 ? Math.round((saving / original) * 100) : 0;
  const isExpired = new Date(product.expiry_date).getTime() <= Date.now();
  const isUnavailable = product.status !== 'active' || product.quantity <= 0 || isExpired;
  const deliveryFee = Number(store?.delivery_fee ?? 0);

  const moreFromStore: CatalogProduct[] = store
    ? sortForDisplay(
        storeProducts
          .filter((p) => p.id !== product.id)
          .map((p) => ({ ...p, store: { id: store.id, name: store.name, address: store.address } }))
      ).slice(0, MORE_FROM_STORE)
    : [];

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/products"
        className="inline-flex items-center gap-1 text-sm font-medium text-forest-800 hover:underline"
      >
        <ChevronLeft className="h-4 w-4" /> กลับไปค้นหาสินค้า
      </Link>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Photo */}
        <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-100">
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
            className={`object-cover ${isUnavailable ? 'grayscale' : ''}`}
          />
          {discountPct > 0 && (
            <span className="absolute left-4 top-4 rounded-xl bg-orange-600 px-3 py-1 text-sm font-bold text-white shadow">
              -{discountPct}%
            </span>
          )}
          <div className="absolute right-4 top-4">
            <ExpiryBadge expiryDate={product.expiry_date} />
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-5">
          <div className="space-y-2">
            <Badge variant="outline" size="sm">
              {categoryLabel(product.category)}
            </Badge>
            <h1 className="text-2xl font-bold text-forest-900 sm:text-3xl">{product.name}</h1>
            {isUnavailable && (
              <Badge variant="danger" size="md">
                {isExpired ? 'หมดอายุแล้ว' : 'สินค้านี้ไม่พร้อมขายแล้ว'}
              </Badge>
            )}
          </div>

          <div className="rounded-2xl bg-orange-50 p-4">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-4xl font-extrabold text-orange-600">฿{price.toLocaleString()}</span>
              <span className="text-lg text-neutral-400 line-through">฿{original.toLocaleString()}</span>
            </div>
            {saving > 0 && (
              <p className="mt-1 text-sm font-semibold text-orange-700">
                ประหยัด ฿{saving.toLocaleString()} ({discountPct}%)
              </p>
            )}
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="flex items-start gap-2 rounded-xl border border-neutral-200 bg-white p-3">
              <CalendarClock className="mt-0.5 h-4 w-4 flex-shrink-0 text-forest-700" />
              <div>
                <dt className="text-xs text-neutral-500">หมดอายุ</dt>
                <dd className="font-medium text-neutral-900">{formatDateTime(product.expiry_date)}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-xl border border-neutral-200 bg-white p-3">
              <Package className="mt-0.5 h-4 w-4 flex-shrink-0 text-forest-700" />
              <div>
                <dt className="text-xs text-neutral-500">คงเหลือ</dt>
                <dd className="font-medium text-neutral-900">{product.quantity} ชิ้น</dd>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-xl border border-neutral-200 bg-white p-3 sm:col-span-2">
              <Truck className="mt-0.5 h-4 w-4 flex-shrink-0 text-forest-700" />
              <div>
                <dt className="text-xs text-neutral-500">การรับสินค้า</dt>
                <dd className="font-medium text-neutral-900">
                  รับเองที่ร้าน (ฟรี)
                  {deliveryFee > 0 && ` หรือให้ไรเดอร์ส่ง ค่าส่ง ฿${deliveryFee.toLocaleString()}`}
                </dd>
              </div>
            </div>
          </dl>

          <div className="max-w-sm">
            <AddToCartButton
              storeId={store?.id ?? product.store_id}
              storeName={store?.name ?? 'ร้านค้า'}
              productId={product.id}
              name={product.name}
              imageUrl={product.image_url}
              unitPrice={price}
              originalPrice={original}
              maxQuantity={product.quantity}
              soldOut={isUnavailable}
              canOrder={canOrder}
            />
          </div>

          {store && (
            <Card>
              <CardContent className="space-y-2 p-4">
                <Link
                  href={`/stores/${store.id}`}
                  className="flex items-center gap-2 font-semibold text-forest-900 hover:underline"
                >
                  <StoreLogo name={store.name} logoUrl={store.logo_url} size="sm" />
                  {store.name}
                </Link>
                {rating.count > 0 && (
                  <div className="flex items-center gap-2">
                    <StarRating value={rating.average} size="sm" />
                    <span className="text-xs text-neutral-600">
                      {rating.average.toFixed(1)} ({rating.count} รีวิว)
                    </span>
                  </div>
                )}
                <p className="flex items-start gap-1.5 text-sm text-neutral-600">
                  <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" /> {store.address}
                </p>
                <p className="flex items-center gap-1.5 text-sm text-neutral-600">
                  <Phone className="h-4 w-4" /> {store.phone}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {moreFromStore.length > 0 && store && (
        <section className="space-y-4">
          <SectionTitle
            action={
              <Link href={`/stores/${store.id}`} className="text-sm font-medium text-forest-800 hover:underline">
                ดูทั้งร้าน
              </Link>
            }
          >
            สินค้าอื่นจาก {store.name}
          </SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {moreFromStore.map((p) => (
              <ProductCard key={p.id} product={p} canOrder={canOrder} />
            ))}
          </div>
        </section>
      )}

      {reviews.length > 0 && store && (
        <section className="space-y-4">
          <SectionTitle>รีวิวร้าน {store.name}</SectionTitle>
          <div className="grid gap-3 md:grid-cols-3">
            {reviews.slice(0, REVIEWS_SHOWN).map((r) => (
              <Card key={r.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-neutral-900">
                      {r.consumer?.full_name ?? 'ลูกค้า'}
                    </span>
                    <StarRating value={r.rating} size="sm" />
                  </div>
                  {r.comment && <p className="text-sm text-neutral-600">{r.comment}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
