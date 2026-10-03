import Image from 'next/image';

export interface ThumbItem {
  name: string;
  quantity: number;
  imageUrl: string | null;
}

const MAX_THUMBS = 3;

/**
 * Overlapping product photos (up to 3, then "+N") with the item names and
 * totals beside them. Shared by the store orders and rider job tables.
 */
export function ProductThumbs({ items }: { items: ThumbItem[] }) {
  const thumbs = items.slice(0, MAX_THUMBS);
  const extra = items.length - thumbs.length;
  const pieces = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-shrink-0 -space-x-3">
        {thumbs.map((item, i) => (
          <div
            key={i}
            className="relative h-12 w-12 overflow-hidden rounded-xl bg-neutral-100 ring-2 ring-white"
          >
            {item.imageUrl && (
              <Image src={item.imageUrl} alt={item.name} fill sizes="48px" className="object-cover" />
            )}
          </div>
        ))}
        {extra > 0 && (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-forest-100 text-xs font-bold text-forest-800 ring-2 ring-white">
            +{extra}
          </div>
        )}
      </div>
      <div className="min-w-0 max-w-[220px]">
        <p className="line-clamp-2 text-neutral-800">
          {items.map((i) => `${i.name} ×${i.quantity}`).join(', ') || '-'}
        </p>
        <p className="text-xs text-neutral-500">
          {items.length} รายการ · {pieces} ชิ้น
        </p>
      </div>
    </div>
  );
}
