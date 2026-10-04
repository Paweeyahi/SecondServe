import Image from 'next/image';
import Link from 'next/link';
import { CalendarClock, HandHeart, MapPin, Phone, StickyNote, Store } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ShareClaimActions } from '@/components/shared/ShareClaimActions';
import { CLAIM_HOLD_HOURS, SHARE_CLAIM_STATUS_LABELS, claimPickupDeadline } from '@/types/share';
import { getMyShareClaims } from '@/lib/queries/shares';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'ของบริจาคที่ขอรับ — SecondServe' };

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

const STATUS_VARIANT = {
  reserved: 'warning',
  collected: 'forest',
  cancelled: 'default',
} as const;

export default async function MyClaimsPage() {
  const claims = await getMyShareClaims();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <PageHeader
          icon={HandHeart}
          title="ของบริจาคที่ขอรับ"
          subtitle="ไปรับที่ร้านก่อนเวลาที่กำหนด แจ้งชื่อของคุณกับพนักงาน แล้วร้านจะยืนยันว่ารับแล้ว"
        />
      </div>

      {claims.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <HandHeart className="h-10 w-10 text-neutral-300" />
            <p className="text-sm text-neutral-500">ยังไม่ได้ขอรับของบริจาค</p>
            <Link href="/shares">
              <Button variant="primary">ดูของที่รับได้ตอนนี้</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {claims.map((claim) => {
            const product = claim.share?.product;
            const store = claim.share?.store;
            const deadline = claimPickupDeadline(claim.created_at, product?.expiry_date);
            const overdue = deadline.getTime() <= Date.now();
            const statusLabel =
              claim.status === 'cancelled' && claim.cancel_reason === 'timeout'
                ? 'ยกเลิกอัตโนมัติ (ไม่ได้มารับตามเวลา)'
                : SHARE_CLAIM_STATUS_LABELS[claim.status];

            return (
              <Card key={claim.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex gap-3">
                    <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                      {product?.image_url && (
                        <Image
                          src={product.image_url}
                          alt={product.name}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate font-semibold text-neutral-900">
                          {product?.name ?? 'สินค้า'} × {claim.quantity}
                        </p>
                        <Badge variant={STATUS_VARIANT[claim.status]} size="sm" className="flex-shrink-0">
                          {statusLabel}
                        </Badge>
                      </div>
                      {store && (
                        <Link
                          href={`/stores/${store.id}`}
                          className="flex items-center gap-1 text-xs text-neutral-600 hover:text-forest-700 hover:underline"
                        >
                          <Store className="h-3.5 w-3.5" />
                          {store.name}
                        </Link>
                      )}
                      <p className="text-xs text-neutral-400">จองเมื่อ {formatDate(claim.created_at)}</p>
                    </div>
                  </div>

                  {claim.status === 'reserved' && (
                    <div className="space-y-1.5 rounded-xl bg-neutral-50 p-3 text-xs text-neutral-600">
                      {store?.address && (
                        <p className="flex items-start gap-1.5">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                          {store.address}
                        </p>
                      )}
                      {store?.phone && (
                        <p className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" />
                          {store.phone}
                        </p>
                      )}
                      <p
                        className={`flex items-center gap-1.5 font-medium ${overdue ? 'text-red-600' : 'text-orange-700'}`}
                      >
                        <CalendarClock className="h-3.5 w-3.5" />
                        {overdue
                          ? 'เลยเวลารับแล้ว ระบบจะยกเลิกการจองเร็ว ๆ นี้'
                          : `ต้องมารับภายใน ${formatDate(deadline.toISOString())}`}
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        ถ้าไม่มารับภายใน {CLAIM_HOLD_HOURS} ชม. หรือก่อนสินค้าหมดอายุ การจองจะถูกยกเลิกอัตโนมัติ
                      </p>
                      {claim.share?.pickup_note && (
                        <p className="flex items-start gap-1.5 text-amber-900">
                          <StickyNote className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                          {claim.share.pickup_note}
                        </p>
                      )}
                    </div>
                  )}

                  {claim.status === 'reserved' && (
                    <ShareClaimActions claimId={claim.id} mode="consumer" />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
