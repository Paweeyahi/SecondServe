import Image from 'next/image';
import Link from 'next/link';
import {
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  HandHeart,
  HeartHandshake,
  MapPin,
  PackageCheck,
  Store,
  StickyNote,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ClaimShareForm } from '@/components/consumer/ClaimShareForm';
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_KEYS, categoryLabel } from '@/types/product';
import { parseShareFeedFilters, type ShareFeedFilters } from '@/lib/validation/share';
import {
  getCommunityShareStats,
  getMyClaimStatusByShare,
  getPublicShares,
  PUBLIC_SHARES_PAGE_SIZE,
  type PublicShare,
} from '@/lib/queries/shares';
import { getUserProfile } from '@/lib/actions/auth';

export const metadata = {
  title: 'ส่งต่ออาหารชุมชน — SecondServe',
};

export const dynamic = 'force-dynamic';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

function feedHref(filters: ShareFeedFilters, patch: Partial<ShareFeedFilters>): string {
  const next = { ...filters, page: 1, ...patch };
  const params = new URLSearchParams();
  if (next.view !== 'available') params.set('view', next.view);
  if (next.category) params.set('category', next.category);
  if (next.page > 1) params.set('page', String(next.page));
  const qs = params.toString();
  return qs ? `/shares?${qs}` : '/shares';
}

function isClaimable(share: PublicShare): boolean {
  return (
    share.remaining > 0 &&
    !!share.store?.verified &&
    !!share.product &&
    new Date(share.product.expiry_date).getTime() > Date.now()
  );
}

const STEPS = [
  { icon: Store, title: 'ร้านค้าส่งต่อ', body: 'ร้านในเครือข่ายแบ่งสินค้าใกล้หมดอายุที่ยังดีอยู่ให้ชุมชนฟรี' },
  { icon: HandHeart, title: 'กดขอรับ', body: 'เข้าสู่ระบบแล้วจองได้คนละไม่เกิน 5 ชิ้นต่อรายการ' },
  { icon: PackageCheck, title: 'ไปรับที่ร้าน', body: 'ไปรับภายใน 24 ชม. แจ้งชื่อกับร้าน ร้านจะยืนยันว่ารับแล้ว ถ้าไม่มารับ การจองจะยกเลิกเอง' },
];

export default async function PublicSharesPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = parseShareFeedFilters(searchParams);
  const [{ shares, total }, stats, session] = await Promise.all([
    getPublicShares(filters),
    getCommunityShareStats(),
    getUserProfile(),
  ]);

  const role = session?.profile?.role ?? null;
  const isConsumer = role === 'consumer';
  const myClaims = isConsumer ? await getMyClaimStatusByShare(shares.map((s) => s.id)) : {};
  const totalPages = Math.max(1, Math.ceil(total / PUBLIC_SHARES_PAGE_SIZE));
  const categoryCounts = new Map(stats.byCategory.map((c) => [c.category, c.quantity]));

  const statTiles = [
    { label: 'ส่งต่อให้ชุมชนแล้ว', value: stats.totalQuantity, unit: 'ชิ้น' },
    {
      label: 'ถึงมือผู้รับแล้ว',
      value: stats.collectedQuantity + stats.foundationDeliveredQuantity,
      unit: 'ชิ้น',
    },
    { label: 'รับได้ตอนนี้', value: stats.availableQuantity, unit: 'ชิ้น' },
    { label: 'ร้านค้าที่ร่วมแบ่งปัน', value: stats.storeCount, unit: 'ร้าน' },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-forest-700">
          <HeartHandshake className="h-6 w-6" />
          <span className="text-sm font-semibold">ส่งต่ออาหารชุมชน</span>
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">
          อาหารดี ๆ ที่ไม่ควรถูกทิ้ง รับฟรีได้ที่ร้านใกล้คุณ
        </h1>
        <p className="max-w-2xl text-sm text-neutral-500">
          สินค้าใกล้หมดอายุที่ร้านค้าในเครือข่ายเลือกส่งต่อให้ชุมชนแทนการทิ้ง
          ใครก็ขอรับได้ ไม่มีค่าใช้จ่าย
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statTiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-2xl border border-forest-200 bg-forest-50/60 p-4"
          >
            <p className="text-2xl font-extrabold text-forest-900 sm:text-3xl">
              {tile.value.toLocaleString()}
              <span className="ml-1 text-sm font-semibold text-forest-700">{tile.unit}</span>
            </p>
            <p className="text-xs text-forest-700 sm:text-sm">{tile.label}</p>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="grid gap-3 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <div key={title} className="flex gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-forest-100 text-forest-800">
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                {i + 1}. {title}
              </p>
              <p className="text-xs text-neutral-500">{body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Partner foundations */}
      {stats.foundations.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">มูลนิธิที่ร่วมโครงการ</h2>
            <p className="text-xs text-neutral-500">
              ร้านค้าเลือกมอบสินค้าทั้งล็อตให้มูลนิธิเหล่านี้โดยตรง เพื่อส่งต่อถึงกลุ่มเปราะบาง
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stats.foundations.map((f) => (
              <div
                key={f.id}
                className="flex gap-3 rounded-2xl border border-purple-100 bg-purple-50/40 p-4"
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-800">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-900">{f.name}</p>
                  {f.description && (
                    <p className="line-clamp-2 text-xs text-neutral-500">{f.description}</p>
                  )}
                  <p className="mt-1 text-xs font-medium text-purple-800">
                    ได้รับแล้ว {f.deliveredQuantity.toLocaleString()} ชิ้น
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3">
        <div className="inline-flex rounded-xl bg-neutral-100 p-1">
          {(
            [
              { view: 'available', label: 'รับได้ตอนนี้' },
              { view: 'all', label: 'ประวัติทั้งหมด' },
            ] as const
          ).map(({ view, label }) => (
            <Link
              key={view}
              href={feedHref(filters, { view })}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filters.view === view
                  ? 'bg-white text-forest-800 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={feedHref(filters, { category: null })}>
            <Badge variant={filters.category === null ? 'forest' : 'outline'} size="md">
              ทุกหมวด
            </Badge>
          </Link>
          {PRODUCT_CATEGORY_KEYS.map((key) => (
            <Link key={key} href={feedHref(filters, { category: key })}>
              <Badge variant={filters.category === key ? 'forest' : 'outline'} size="md">
                {PRODUCT_CATEGORIES[key]}
                {categoryCounts.has(key) && (
                  <span className="ml-1 opacity-60">{categoryCounts.get(key)}</span>
                )}
              </Badge>
            </Link>
          ))}
        </div>
      </div>

      {/* Feed */}
      {shares.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <HeartHandshake className="h-10 w-10 text-neutral-300" />
            <p className="text-sm text-neutral-500">
              {filters.view === 'available'
                ? 'ตอนนี้ยังไม่มีของบริจาคที่รับได้ในหมวดนี้ ลองกลับมาดูใหม่ภายหลัง'
                : 'ยังไม่มีการส่งต่อสินค้าให้ชุมชนในหมวดนี้'}
            </p>
            {filters.view === 'available' && (
              <Link href={feedHref(filters, { view: 'all' })}>
                <Button variant="outline" size="sm">
                  ดูประวัติทั้งหมด
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shares.map((share) => {
            const claimable = isClaimable(share);
            const myStatus = myClaims[share.id];
            const claimedPct = Math.round(
              ((share.quantity - share.remaining) / share.quantity) * 100
            );

            return (
              <div
                key={share.id}
                className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
              >
                <div className="flex gap-3">
                  <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                    {share.product?.image_url && (
                      <Image
                        src={share.product.image_url}
                        alt={share.product.name ?? ''}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-semibold text-neutral-900">
                        {share.product?.name ?? 'สินค้า'}
                      </p>
                      {share.foundation_id ? (
                        <Badge variant="admin" size="sm" className="flex-shrink-0">
                          มอบให้มูลนิธิ
                        </Badge>
                      ) : claimable ? (
                        <Badge variant="forest" size="sm" className="flex-shrink-0">
                          รับได้
                        </Badge>
                      ) : (
                        <Badge variant="default" size="sm" className="flex-shrink-0">
                          {share.remaining === 0 ? 'มีผู้รับครบแล้ว' : 'ปิดรับแล้ว'}
                        </Badge>
                      )}
                    </div>
                    {share.store && (
                      <Link
                        href={`/stores/${share.store.id}`}
                        className="flex items-center gap-1 text-xs text-neutral-600 hover:text-forest-700 hover:underline"
                      >
                        <Store className="h-3.5 w-3.5" />
                        {share.store.name}
                        {share.product?.category && ` · ${categoryLabel(share.product.category)}`}
                      </Link>
                    )}
                    {share.store?.address && (
                      <p className="flex items-start gap-1 text-xs text-neutral-500">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                        <span className="line-clamp-2">{share.store.address}</span>
                      </p>
                    )}
                    {share.product?.expiry_date && (
                      <p className="flex items-center gap-1 text-xs text-neutral-500">
                        <CalendarClock className="h-3.5 w-3.5" />
                        รับได้ถึง {formatDate(share.product.expiry_date)}
                      </p>
                    )}
                  </div>
                </div>

                {share.foundation_id && (
                  <p className="flex items-center gap-1.5 rounded-lg bg-purple-50 px-3 py-2 text-xs text-purple-900">
                    <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                    มอบให้ {share.foundation?.name ?? 'มูลนิธิ'} ทั้งหมด {share.quantity} ชิ้น ·{' '}
                    {share.delivered_at ? 'ส่งมอบแล้ว' : 'กำลังส่งมอบ'}
                  </p>
                )}

                {share.pickup_note && !share.foundation_id && (
                  <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <StickyNote className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    {share.pickup_note}
                  </p>
                )}

                {!share.foundation_id && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-neutral-500">
                      <span>
                        เหลือ <span className="font-semibold text-neutral-900">{share.remaining}</span>{' '}
                        จาก {share.quantity} ชิ้น
                      </span>
                      <span>ส่งต่อเมื่อ {formatDate(share.created_at)}</span>
                    </div>
                    <div
                      className="h-1.5 overflow-hidden rounded-full bg-neutral-100"
                      role="progressbar"
                      aria-valuenow={claimedPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="สัดส่วนที่มีผู้ขอรับแล้ว"
                    >
                      <div
                        className="h-full rounded-full bg-forest-600"
                        style={{ width: `${claimedPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {claimable && (
                  <div className="border-t border-neutral-100 pt-3">
                    {myStatus ? (
                      <p className="text-sm text-forest-700">
                        {myStatus === 'collected'
                          ? 'คุณรับรายการนี้ไปแล้ว'
                          : 'คุณจองรายการนี้ไว้แล้ว'}{' '}
                        ·{' '}
                        <Link href="/claims" className="font-medium underline">
                          ดูรายละเอียด
                        </Link>
                      </p>
                    ) : isConsumer ? (
                      <ClaimShareForm shareId={share.id} remaining={share.remaining} />
                    ) : !session ? (
                      <Link href="/login?next=/shares">
                        <Button
                          size="sm"
                          variant="outline"
                          leftIcon={<HandHeart className="h-4 w-4" />}
                        >
                          เข้าสู่ระบบเพื่อขอรับ
                        </Button>
                      </Link>
                    ) : (
                      <p className="text-xs text-neutral-400">
                        เฉพาะบัญชีผู้บริโภคที่ขอรับของบริจาคได้
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          {filters.page > 1 ? (
            <Link href={feedHref(filters, { page: filters.page - 1 })}>
              <Button variant="outline" size="sm" leftIcon={<ChevronLeft className="h-4 w-4" />}>
                ก่อนหน้า
              </Button>
            </Link>
          ) : (
            <Button variant="outline" size="sm" disabled leftIcon={<ChevronLeft className="h-4 w-4" />}>
              ก่อนหน้า
            </Button>
          )}
          <span className="text-sm text-neutral-500">
            หน้า {filters.page} / {totalPages}
          </span>
          {filters.page < totalPages ? (
            <Link href={feedHref(filters, { page: filters.page + 1 })}>
              <Button variant="outline" size="sm" rightIcon={<ChevronRight className="h-4 w-4" />}>
                ถัดไป
              </Button>
            </Link>
          ) : (
            <Button variant="outline" size="sm" disabled rightIcon={<ChevronRight className="h-4 w-4" />}>
              ถัดไป
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
