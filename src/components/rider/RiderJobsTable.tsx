import Link from 'next/link';
import { CheckCircle2, ChevronRight, MapPin, Store } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import type { JobPoolItem } from '@/lib/queries/rider';
import { ProductThumbs } from '@/components/shared/ProductThumbs';
import { ClaimJobButton } from './ClaimJobButton';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Rider job list as a table with product photos. `pool` rows get a claim
 * button; `history` rows show the completed badge. Scrolls horizontally on
 * narrow screens, same as the store orders table.
 */
export function RiderJobsTable({ jobs, mode }: { jobs: JobPoolItem[]; mode: 'pool' | 'history' }) {
  return (
    <>
      <ul className="space-y-3 md:hidden">
        {jobs.map((job) => (
          <RiderJobMobileCard key={job.id} job={job} mode={mode} />
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm md:block">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-gradient-to-r from-forest-800 to-forest-700">
          <tr className="text-left text-xs font-semibold tracking-wide text-white">
            <th className="px-4 py-3">ออเดอร์</th>
            <th className="px-4 py-3">สินค้า</th>
            <th className="px-4 py-3">รับของที่ร้าน</th>
            <th className="px-4 py-3">ส่งที่</th>
            <th className="px-4 py-3 text-right">ค่าส่ง</th>
            <th className="px-4 py-3">{mode === 'pool' ? 'รับงาน' : 'สถานะ'}</th>
            <th className="px-2 py-3">
              <span className="sr-only">รายละเอียด</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {jobs.map((job) => {
            const href = `/dashboard/rider/jobs/${job.id}`;
            const shortId = job.id.slice(0, 8).toUpperCase();

            return (
              <tr key={job.id} className="align-middle hover:bg-forest-50/40">
                <td className="px-4 py-3">
                  <Link
                    href={href}
                    className="font-mono font-semibold text-neutral-900 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-500"
                  >
                    #{shortId}
                  </Link>
                  <p className="text-xs text-neutral-500">{formatDate(job.created_at)}</p>
                </td>

                <td className="px-4 py-3">
                  <ProductThumbs items={job.items} />
                </td>

                <td className="px-4 py-3">
                  <p className="flex items-center gap-1 font-medium text-neutral-900">
                    <Store className="h-3.5 w-3.5 flex-shrink-0 text-forest-700" />
                    {job.store?.name ?? 'ร้านค้า'}
                  </p>
                  <p className="line-clamp-2 max-w-[200px] text-xs text-neutral-500">
                    {job.store?.address ?? '-'}
                  </p>
                </td>

                <td className="px-4 py-3">
                  <p className="flex max-w-[220px] items-start gap-1 text-neutral-700">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-orange-600" />
                    <span className="line-clamp-2">{job.delivery_address ?? '-'}</span>
                  </p>
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-orange-600">
                  ฿{Number(job.delivery_fee).toLocaleString()}
                </td>

                <td className="px-4 py-3">
                  {mode === 'pool' ? (
                    <ClaimJobButton orderId={job.id} />
                  ) : (
                    <Badge variant="forest" size="sm" className="gap-1 whitespace-nowrap">
                      <CheckCircle2 className="h-3.5 w-3.5" /> จัดส่งสำเร็จ
                    </Badge>
                  )}
                </td>

                <td className="px-2 py-3">
                  <Link
                    href={href}
                    aria-label={`ดูรายละเอียดออเดอร์ #${shortId}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}

function RiderJobMobileCard({ job, mode }: { job: JobPoolItem; mode: 'pool' | 'history' }) {
  const href = `/dashboard/rider/jobs/${job.id}`;
  return (
    <li className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link href={href} className="font-mono font-semibold text-neutral-900 underline decoration-neutral-300 underline-offset-2">
            #{job.id.slice(0, 8).toUpperCase()}
          </Link>
          <p className="text-xs text-neutral-500">{formatDate(job.created_at)}</p>
        </div>
        <p className="text-lg font-bold text-orange-600">฿{Number(job.delivery_fee).toLocaleString()}</p>
      </div>
      <ProductThumbs items={job.items} />
      <div className="space-y-2 rounded-xl bg-neutral-50 p-3 text-sm">
        <p className="flex items-start gap-1.5">
          <Store className="mt-0.5 h-4 w-4 flex-shrink-0 text-forest-700" />
          <span>
            <span className="font-medium text-neutral-900">{job.store?.name ?? 'ร้านค้า'}</span>
            <span className="block text-xs text-neutral-500">{job.store?.address ?? '-'}</span>
          </span>
        </p>
        <p className="flex items-start gap-1.5 text-neutral-700">
          <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-600" />
          {job.delivery_address ?? '-'}
        </p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Link href={href} className="flex items-center text-sm font-medium text-forest-800">
          รายละเอียด <ChevronRight className="h-4 w-4" />
        </Link>
        {mode === 'pool' ? (
          <ClaimJobButton orderId={job.id} />
        ) : (
          <Badge variant="forest" size="sm" className="gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> จัดส่งสำเร็จ
          </Badge>
        )}
      </div>
    </li>
  );
}