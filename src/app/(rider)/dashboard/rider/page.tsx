import Link from 'next/link';
import Image from 'next/image';
import { Bike, MapPin, CheckCircle2, Clock, Star, Store } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { StarRating } from '@/components/shared/StarRating';
import { ShiftToggle } from '@/components/rider/ShiftToggle';
import { getCurrentRider, getJobPool, getActiveJob } from '@/lib/queries/rider';
import { getRiderRatingSummary } from '@/lib/queries/reviews';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  available: 'พร้อมรับงาน',
  busy: 'กำลังจัดส่ง',
  offline: 'ปิดรับงาน',
};

export default async function RiderDashboardPage() {
  const rider = await getCurrentRider();
  const [jobPool, activeJob, ratingSummary] = await Promise.all([
    getJobPool(),
    rider ? getActiveJob(rider.id) : Promise.resolve(null),
    rider ? getRiderRatingSummary(rider.id) : Promise.resolve({ average: 0, count: 0 }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Badge variant="rider">ไรเดอร์</Badge>
          {rider && !rider.verified && (
            <Badge variant="warning">รอการยืนยันตัวตนจากแอดมิน</Badge>
          )}
        </div>
        {rider && <ShiftToggle status={rider.status} />}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-500">งานใน Job Pool</span>
              <MapPin className="h-5 w-5 text-sky-600" />
            </div>
            <CardTitle className="text-3xl font-extrabold">{jobPool.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/rider/jobs">
              <Button variant="outline" size="sm">ดูงานทั้งหมด</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-500">งานที่กำลังทำ</span>
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <CardTitle className="text-3xl font-extrabold">{activeJob ? 1 : 0}</CardTitle>
          </CardHeader>
          <CardContent>
            {activeJob ? (
              <Link href={`/dashboard/rider/jobs/${activeJob.id}`}>
                <Button variant="outline" size="sm">ไปที่งานปัจจุบัน</Button>
              </Link>
            ) : (
              <p className="text-xs text-neutral-500">ไม่มีงานที่กำลังดำเนินการ</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-500">สถานะปัจจุบัน</span>
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <CardTitle className="text-2xl font-extrabold">
              {rider ? STATUS_LABEL[rider.status] : '-'}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-500">คะแนนรีวิว</span>
              <Star className="h-5 w-5 text-amber-500" />
            </div>
            <CardTitle className="text-2xl font-extrabold">
              {ratingSummary.count > 0 ? ratingSummary.average.toFixed(1) : '-'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ratingSummary.count > 0 ? (
              <div className="flex items-center gap-2">
                <StarRating value={ratingSummary.average} size="sm" />
                <span className="text-xs text-neutral-500">({ratingSummary.count} รีวิว)</span>
              </div>
            ) : (
              <p className="text-xs text-neutral-500">ยังไม่มีรีวิว</p>
            )}
          </CardContent>
        </Card>
      </div>

      {activeJob && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">งานที่กำลังทำอยู่</CardTitle>
              <Link href={`/dashboard/rider/jobs/${activeJob.id}`}>
                <Button variant="outline" size="sm">ดูรายละเอียด</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="flex items-center gap-1.5 text-sm text-neutral-700">
              <Store className="h-4 w-4" /> {activeJob.store?.name ?? 'ร้านค้า'}
            </p>
            <div className="space-y-2 rounded-lg bg-neutral-50 p-2">
              <p className="px-1 text-xs font-medium text-neutral-500">ต้องไปรับที่ร้าน</p>
              {activeJob.items.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-200">
                    {item.imageUrl && (
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        className="object-cover"
                      />
                    )}
                  </div>
                  <span className="text-sm text-neutral-700">
                    {item.name} × {item.quantity}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!activeJob && rider?.status === 'available' && jobPool.length > 0 && (
        <Card className="border-dashed bg-sky-50/40">
          <CardContent className="space-y-3 p-8 text-center">
            <Bike className="mx-auto h-10 w-10 text-sky-700" />
            <h3 className="text-lg font-bold text-neutral-900">
              มีงานรอให้รับ {jobPool.length} งาน
            </h3>
            <Link href="/dashboard/rider/jobs">
              <Button variant="primary">ไปที่ Job Pool</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
