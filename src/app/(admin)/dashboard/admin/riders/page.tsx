import { Star } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ModerationTable } from '@/components/admin/ModerationTable';
import { RiderVerifyToggle } from '@/components/admin/RiderVerifyToggle';
import { getAllRiders } from '@/lib/queries/admin';
import { getRiderRatingSummaries } from '@/lib/queries/reviews';
import { SectionTitle } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

const SHIFT_LABEL: Record<string, string> = {
  available: 'พร้อมรับงาน',
  busy: 'กำลังจัดส่ง',
  offline: 'ปิดรับงาน',
};

export default async function AdminRidersPage() {
  const riders = await getAllRiders();
  const ratings = await getRiderRatingSummaries(riders.map((r) => r.id));

  return (
    <div className="space-y-4">
      <SectionTitle>ไรเดอร์ทั้งหมด ({riders.length})</SectionTitle>
      <ModerationTable
        headers={['ชื่อ', 'เบอร์โทร', 'พาหนะ', 'สถานะกะ', 'คะแนน', 'ยืนยันตัวตน', '']}
      >
        {riders.map((rider) => {
          const rating = ratings[rider.id];
          return (
          <tr key={rider.id}>
            <td className="px-4 py-3 font-medium text-neutral-900">
              {rider.profile?.full_name ?? '-'}
            </td>
            <td className="px-4 py-3 text-neutral-600">{rider.profile?.phone ?? '-'}</td>
            <td className="px-4 py-3 text-neutral-600">{rider.vehicle_type}</td>
            <td className="px-4 py-3 text-neutral-600">{SHIFT_LABEL[rider.status]}</td>
            <td className="px-4 py-3 text-neutral-600">
              {rating && rating.count > 0 ? (
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {rating.average.toFixed(1)} ({rating.count})
                </span>
              ) : (
                '-'
              )}
            </td>
            <td className="px-4 py-3">
              {rider.verified ? (
                <Badge variant="forest" size="sm">
                  ยืนยันแล้ว
                </Badge>
              ) : (
                <Badge variant="warning" size="sm">
                  รอตรวจสอบ
                </Badge>
              )}
            </td>
            <td className="px-4 py-3">
              <RiderVerifyToggle riderId={rider.id} verified={rider.verified} />
            </td>
          </tr>
          );
        })}
      </ModerationTable>
    </div>
  );
}
