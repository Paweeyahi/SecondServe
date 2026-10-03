import { MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { SectionTitle } from '@/components/ui/PageHeader';
import { Pagination, parsePage } from '@/components/ui/Pagination';
import { RiderJobsTable } from '@/components/rider/RiderJobsTable';
import {
  RIDER_JOBS_PAGE_SIZE,
  getActiveJob,
  getCurrentRider,
  getJobPoolPage,
} from '@/lib/queries/rider';

export const dynamic = 'force-dynamic';

function poolHref(page: number): string {
  return page > 1 ? `/dashboard/rider/jobs?page=${page}` : '/dashboard/rider/jobs';
}

export default async function RiderJobsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const rider = await getCurrentRider();
  const activeJob = rider ? await getActiveJob(rider.id) : null;

  if (activeJob) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-neutral-600">
          คุณมีงานที่กำลังดำเนินการอยู่ ต้องส่งงานนี้ให้เสร็จก่อนจึงจะรับงานใหม่ได้
        </CardContent>
      </Card>
    );
  }

  if (rider && !rider.verified) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-neutral-600">
          บัญชีของคุณยังไม่ได้รับการยืนยันจากแอดมิน จึงยังรับงานไม่ได้
        </CardContent>
      </Card>
    );
  }

  const page = parsePage(searchParams.page);
  const { jobs, total } = await getJobPoolPage(page);

  return (
    <div className="space-y-4">
      <SectionTitle subtitle="เรียงจากออเดอร์ที่รอนานที่สุด">Job Pool ({total})</SectionTitle>

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <MapPin className="h-10 w-10 text-neutral-300" />
            <p className="text-sm text-neutral-500">ยังไม่มีงานจัดส่งในขณะนี้</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <RiderJobsTable jobs={jobs} mode="pool" />
          <Pagination
            page={page}
            pageSize={RIDER_JOBS_PAGE_SIZE}
            total={total}
            unit="งาน"
            hrefForPage={poolHref}
          />
        </>
      )}
    </div>
  );
}
