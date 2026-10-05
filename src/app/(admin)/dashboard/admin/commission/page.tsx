import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { CommissionOverview, commissionPercent } from '@/components/admin/CommissionOverview';
import { ModerationTable } from '@/components/admin/ModerationTable';
import { getCommissionSummary, getStoreSalesReport } from '@/lib/queries/admin';
import { SectionTitle } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

function formatBaht(n: number): string {
  const frac = Number.isInteger(n) ? 0 : 2;
  return `฿${n.toLocaleString('th-TH', { minimumFractionDigits: frac, maximumFractionDigits: frac })}`;
}

export default async function AdminCommissionPage() {
  const [summary, report] = await Promise.all([getCommissionSummary(), getStoreSalesReport()]);
  const ratePercent = commissionPercent(summary);
  const total = report.reduce((s, r) => s + r.commission, 0);
  const maxCommission = Math.max(...report.map((r) => r.commission), 1);

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <SectionTitle subtitle="ระบบหักอัตโนมัติจากยอดขายสินค้าของทุกออเดอร์ที่สำเร็จ (ไม่รวมค่าจัดส่ง) แต่ละออเดอร์ใช้อัตรา ณ เวลาที่สั่งซื้อ">
          ค่าคอมมิชชันแพลตฟอร์ม
        </SectionTitle>
        <CommissionOverview summary={summary} />
      </section>

      <section className="space-y-3">
        <SectionTitle subtitle={`รวมหักแล้ว ${formatBaht(total)} · อัตราปัจจุบัน ${ratePercent}% · กดที่ร้านเพื่อดูทุกออเดอร์ที่ถูกหัก`}>
          ค่าคอมมิชชันแยกตามร้านค้า ({report.length} ร้าน)
        </SectionTitle>
        <ModerationTable
          headers={['ร้านค้า', 'ออเดอร์สำเร็จ', 'ยอดขายสินค้า', 'ถูกหักคอมมิชชัน', 'สัดส่วน', 'สุทธิของร้าน', '']}
        >
          {report.map((row) => (
            <tr key={row.store_id} className="hover:bg-forest-50/40">
              <td className="px-4 py-3 font-medium text-neutral-900">
                <Link href={`/dashboard/admin/commission/${row.store_id}`} className="hover:text-forest-800 hover:underline">
                  {row.store_name}
                </Link>
              </td>
              <td className="px-4 py-3 text-right text-neutral-600">{row.orders.toLocaleString()}</td>
              <td className="px-4 py-3 text-right text-neutral-900">{formatBaht(row.revenue)}</td>
              <td className="px-4 py-3 text-right font-semibold text-orange-600">
                {row.commission > 0 ? `−${formatBaht(row.commission)}` : formatBaht(0)}
              </td>
              <td className="w-32 px-4 py-3">
                <div className="h-2 w-full rounded-full bg-neutral-100" aria-hidden>
                  <div
                    className="h-2 rounded-full bg-orange-500"
                    style={{ width: `${(row.commission / maxCommission) * 100}%` }}
                  />
                </div>
                <span className="sr-only">
                  {total > 0 ? Math.round((row.commission / total) * 100) : 0}% ของคอมมิชชันทั้งหมด
                </span>
              </td>
              <td className="px-4 py-3 text-right font-medium text-forest-800">{formatBaht(row.net)}</td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/dashboard/admin/commission/${row.store_id}`}
                  className="inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-medium text-forest-800 hover:underline"
                >
                  รายละเอียด <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </td>
            </tr>
          ))}
        </ModerationTable>
      </section>
    </div>
  );
}
