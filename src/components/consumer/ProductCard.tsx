import Link from 'next/link';
import Image from 'next/image';
import { Store as StoreIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { categoryLabel } from '@/types/product';
import { ExpiryBadge } from './ExpiryBadge';
import { AddToCartButton } from './AddToCartButton';
import type { CatalogProduct } from '@/lib/queries/catalog';

export function ProductCard({
  product,
  canOrder = false,
}: {
  product: CatalogProduct;
  canOrder?: boolean;
}) {
  const discountPct = Math.round(
    (1 - product.discount_price / product.original_price) * 100
  );
  const savingBaht = Number(product.original_price) - Number(product.discount_price);
  const isExpired = new Date(product.expiry_date).getTime() <= Date.now();
  const isUnavailable = product.status !== 'active' || product.quantity <= 0 || isExpired;

  return (
    <Card
      hoverEffect={!isUnavailable}
      className={`flex flex-col overflow-hidden ${isUnavailable ? 'opacity-60' : ''}`}
    >
      <Link
        href={`/products/${product.id}`}
        className="relative block aspect-[4/3] w-full bg-neutral-100"
        aria-label={product.name}
      >
        <Image
          src={product.image_url}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className={`object-cover ${isUnavailable ? 'grayscale' : ''}`}
        />
        {discountPct > 0 && (
          <span className="absolute left-2 top-2 rounded-lg bg-orange-600 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
            -{discountPct}%
          </span>
        )}
        <div className="absolute right-2 top-2">
          <ExpiryBadge expiryDate={product.expiry_date} />
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" size="sm">
            {categoryLabel(product.category)}
          </Badge>
        </div>

        <Link href={`/products/${product.id}`} className="hover:text-forest-800">
          <h3 className="font-semibold text-neutral-900 line-clamp-2 hover:text-forest-800">
            {product.name}
          </h3>
        </Link>

        <div className="flex items-baseline gap-2">
          <span className="text-lg font-extrabold text-orange-600">
            ฿{product.discount_price.toLocaleString()}
          </span>
          <span className="text-xs text-neutral-400 line-through">
            ฿{product.original_price.toLocaleString()}
          </span>
        </div>
        {savingBaht > 0 && (
          <p className="text-xs font-semibold text-orange-700">
            ประหยัด ฿{savingBaht.toLocaleString()}
          </p>
        )}

        <p className="text-xs text-neutral-500">คงเหลือ {product.quantity} ชิ้น</p>

        {product.store && (
          <Link
            href={`/stores/${product.store.id}`}
            className="flex items-center gap-1 pt-2 text-xs font-medium text-forest-700 underline decoration-forest-300 underline-offset-2 hover:decoration-forest-600"
          >
            <StoreIcon className="h-3.5 w-3.5" />
            <span className="line-clamp-1">{product.store.name}</span>
            {product.distanceKm != null && (
              <span className="flex-shrink-0 text-neutral-500 no-underline">
                · {product.distanceKm < 1
                  ? `${Math.round(product.distanceKm * 1000)} ม.`
                  : `${product.distanceKm.toFixed(1)} กม.`}
              </span>
            )}
            <span aria-hidden className="text-forest-400">
              ›
            </span>
          </Link>
        )}

        <div className="mt-2 pt-1">
          <AddToCartButton
            storeId={product.store?.id ?? product.store_id}
            storeName={product.store?.name ?? 'ร้านค้า'}
            productId={product.id}
            name={product.name}
            imageUrl={product.image_url}
            unitPrice={Number(product.discount_price)}
            originalPrice={Number(product.original_price)}
            maxQuantity={product.quantity}
            soldOut={isUnavailable}
            canOrder={canOrder}
          />
        </div>
      </div>
    </Card>
  );
}
