import { PackageCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { SectionTitle } from '@/components/ui/PageHeader';
import { Pagination, parsePage } from '@/components/ui/Pagination';
import { RiderJobsTable } from '@/components/rider/RiderJobsTable';
import {
  RIDER_JOBS_PAGE_SIZE,
  getCurrentRider,
  getRiderDeliveryHistoryPage,
  getRiderTotalEarnings,
} from '@/lib/queries/rider';

export const dynamic = 'force-dynamic';

function historyHref(page: number): string {
  return page > 1 ? `/dashboard/rider/history?page=${page}` : '/dashboard/rider/history';
}

export default async function RiderHistoryPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const rider = await getCurrentRider();
  if (!rider) return null;

  const page = parsePage(searchParams.page);
  const [{ jobs, total }, earnings] = await Promise.all([
    getRiderDeliveryHistoryPage(rider.id, page),
    getRiderTotalEarnings(rider.id),
  ]);

  return (
    <div className="space-y-4">
      <SectionTitle subtitle={`ค่าส่งที่ได้รับทั้งหมด ฿${earnings.toLocaleString()}`}>
        ประวัติการจัดส่ง ({total})
      </SectionTitle>

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <PackageCheck className="h-10 w-10 text-neutral-300" />
            <p className="text-sm text-neutral-500">ยังไม่มีงานจัดส่งที่เสร็จสิ้น</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <RiderJobsTable jobs={jobs} mode="history" />
          <Pagination
            page={page}
            pageSize={RIDER_JOBS_PAGE_SIZE}
            total={total}
            unit="งาน"
            hrefForPage={historyHref}
          />
        </>
      )}
    </div>
  );
}
