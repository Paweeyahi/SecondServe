import Link from 'next/link';
import Image from 'next/image';
import { Pencil } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { categoryLabel, type ProductStatus } from '@/types/product';
import type { ProductRow } from '@/lib/queries/store';
import { DeleteProductButton } from './DeleteProductButton';
import { ShareProductButton } from './ShareProductButton';

const STATUS_META: Record<ProductStatus, { label: string; variant: BadgeProps['variant'] }> = {
  active: { label: 'กำลังขาย', variant: 'forest' },
  sold_out: { label: 'ของหมด', variant: 'warning' },
  expired: { label: 'หมดอายุ', variant: 'danger' },
  shared: { label: 'ส่งต่อชุมชน', variant: 'consumer' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function StoreProductCard({
  product,
  foundations,
}: {
  product: ProductRow;
  foundations: { id: string; name: string }[];
}) {
  const status = STATUS_META[product.status];
  const expired = new Date(product.expiry_date).getTime() < Date.now();

  return (
    <div className="flex gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl border border-neutral-100 bg-neutral-50">
        <Image
          src={product.image_url}
          alt={product.name}
          fill
          sizes="96px"
          className="object-cover"
        />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-neutral-900 line-clamp-1">{product.name}</h3>
          <Badge variant={status.variant} size="sm">
            {status.label}
          </Badge>
          {expired && product.status !== 'expired' && (
            <Badge variant="danger" size="sm">
              เลยวันหมดอายุ
            </Badge>
          )}
        </div>

        <p className="text-xs text-neutral-500">{categoryLabel(product.category)}</p>

        <div className="flex items-baseline gap-2 text-sm">
          <span className="font-bold text-orange-600">
            ฿{product.discount_price.toLocaleString()}
          </span>
          <span className="text-xs text-neutral-400 line-through">
            ฿{product.original_price.toLocaleString()}
          </span>
          <span className="text-xs text-neutral-500">· คงเหลือ {product.quantity}</span>
        </div>

        <p className="text-xs text-neutral-500">หมดอายุ {formatDate(product.expiry_date)}</p>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <Link href={`/dashboard/store/products/${product.id}/edit`}>
              <Button variant="outline" size="sm" leftIcon={<Pencil className="h-4 w-4" />}>
                แก้ไข
              </Button>
            </Link>
            {product.status === 'active' && (
              <ShareProductButton
                productId={product.id}
                productName={product.name}
                quantity={product.quantity}
                foundations={foundations}
              />
            )}
          </div>
          <DeleteProductButton productId={product.id} productName={product.name} />
        </div>
      </div>
    </div>
  );
}
