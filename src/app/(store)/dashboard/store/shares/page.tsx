import Image from 'next/image';
import {
  Building2,
  CalendarClock,
  HeartHandshake,
  MapPin,
  Phone,
  StickyNote,
  User,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ShareClaimActions } from '@/components/shared/ShareClaimActions';
import { FoundationDeliveredButton } from '@/components/store/FoundationDeliveredButton';
import { SHARE_CLAIM_STATUS_LABELS, claimPickupDeadline } from '@/types/share';
import { getCurrentStore } from '@/lib/queries/store';
import { getStoreShares } from '@/lib/queries/shares';
import { SectionTitle } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

const STATUS_VARIANT = {
  reserved: 'warning',
  collected: 'forest',
  cancelled: 'default',
} as const;

export default async function StoreSharesPage() {
  const store = await getCurrentStore();
  const shares = store ? await getStoreShares(store.id) : [];

  const allClaims = shares.flatMap((s) => s.claims);
  const totalShared = shares.reduce((sum, s) => sum + s.quantity, 0);
  const collected =
    allClaims.filter((c) => c.status === 'collected').reduce((sum, c) => sum + c.quantity, 0) +
    shares.filter((s) => s.delivered_at).reduce((sum, s) => sum + s.quantity, 0);
  const waiting =
    allClaims.filter((c) => c.status === 'reserved').length +
    shares.filter((s) => s.foundation_id && !s.delivered_at).length;

  const tiles = [
    { label: 'แชร์ให้ชุมชนทั้งหมด', value: `${totalShared.toLocaleString()} ชิ้น` },
    { label: 'ส่งถึงมือผู้รับแล้ว', value: `${collected.toLocaleString()} ชิ้น` },
    { label: 'คำขอรอส่งมอบ', value: `${waiting} รายการ` },
  ];

  return (
    <div className="space-y-4">
      <SectionTitle>แชร์ให้ชุมชน</SectionTitle>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="text-xl font-bold text-neutral-900">{t.value}</p>
            <p className="text-xs text-neutral-500">{t.label}</p>
          </div>
        ))}
      </div>

      {shares.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <HeartHandshake className="h-10 w-10 text-neutral-300" />
            <p className="text-sm text-neutral-500">
              ยังไม่มีการแชร์สินค้า — กด &ldquo;แชร์ให้ชุมชน&rdquo; ที่หน้าสินค้าเพื่อส่งต่อสินค้าใกล้หมดอายุ
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {shares.map((share) => {
            const expired =
              !!share.product && new Date(share.product.expiry_date).getTime() <= Date.now();
            const liveClaims = share.claims.filter((c) => c.status !== 'cancelled');

            return (
              <div
                key={share.id}
                className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                    {share.product?.image_url && (
                      <Image
                        src={share.product.image_url}
                        alt={share.product.name ?? ''}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-neutral-900">
                      {share.product?.name ?? 'สินค้า'}
                    </p>
                    <p className="text-xs text-neutral-500">แชร์เมื่อ {formatDate(share.created_at)}</p>
                    {share.product?.expiry_date && (
                      <p
                        className={`flex items-center gap-1 text-xs ${expired ? 'text-red-600' : 'text-neutral-500'}`}
                      >
                        <CalendarClock className="h-3.5 w-3.5" />
                        {expired ? 'หมดอายุแล้ว' : 'หมดอายุ'} {formatDate(share.product.expiry_date)}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {share.foundation_id ? (
                      <p className="text-sm font-semibold text-emerald-700">
                        {share.quantity} ชิ้น
                      </p>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-emerald-700">
                          เหลือ {share.remaining}/{share.quantity}
                        </p>
                        <p className="text-xs text-neutral-500">{liveClaims.length} คำขอ</p>
                      </>
                    )}
                  </div>
                </div>

                {share.pickup_note && (
                  <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <StickyNote className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    {share.pickup_note}
                  </p>
                )}

                {share.foundation_id && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-purple-100 bg-purple-50/50 px-3 py-2.5">
                    <div className="min-w-0 space-y-0.5">
                      <p className="flex items-center gap-1.5 text-sm font-medium text-neutral-900">
                        <Building2 className="h-3.5 w-3.5 text-purple-600" />
                        มอบให้ {share.foundation?.name ?? 'มูลนิธิ'}
                      </p>
                      <p className="flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
                        {share.foundation?.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {share.foundation.phone}
                          </span>
                        )}
                        {share.foundation?.address && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {share.foundation.address}
                          </span>
                        )}
                      </p>
                    </div>
                    {share.delivered_at ? (
                      <Badge variant="forest" size="sm">
                        ส่งมอบแล้ว {formatDate(share.delivered_at)}
                      </Badge>
                    ) : (
                      <FoundationDeliveredButton shareId={share.id} />
                    )}
                  </div>
                )}

                {share.claims.length > 0 && (
                  <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-100">
                    {share.claims.map((claim) => (
                      <li
                        key={claim.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <p className="flex items-center gap-1.5 text-sm font-medium text-neutral-900">
                            <User className="h-3.5 w-3.5 text-neutral-400" />
                            {claim.claimer?.full_name ?? 'ผู้ใช้'} · {claim.quantity} ชิ้น
                          </p>
                          <p className="flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
                            {claim.claimer?.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {claim.claimer.phone}
                              </span>
                            )}
                            <span>จองเมื่อ {formatDate(claim.created_at)}</span>
                            {claim.status === 'reserved' && (
                              <span className="font-medium text-orange-700">
                                · ยกเลิกอัตโนมัติ{' '}
                                {formatDate(
                                  claimPickupDeadline(claim.created_at, share.product?.expiry_date).toISOString()
                                )}
                              </span>
                            )}
                          </p>
                        </div>
                        {claim.status === 'reserved' ? (
                          <ShareClaimActions claimId={claim.id} mode="store" />
                        ) : (
                          <Badge variant={STATUS_VARIANT[claim.status]} size="sm">
                            {claim.cancel_reason === 'timeout'
                              ? 'ยกเลิกอัตโนมัติ (ไม่มารับ)'
                              : SHARE_CLAIM_STATUS_LABELS[claim.status]}
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
