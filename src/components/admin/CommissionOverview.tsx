import { Percent } from 'lucide-react';
import { CommissionRateForm } from '@/components/admin/CommissionRateForm';
import type { CommissionSummary } from '@/lib/queries/admin';

function formatBaht(n: number): string {
  const frac = Number.isInteger(n) ? 0 : 2;
  return `฿${n.toLocaleString('th-TH', { minimumFractionDigits: frac, maximumFractionDigits: frac })}`;
}

export function commissionPercent(summary: CommissionSummary | null): number {
  return summary ? Math.round(summary.rate * 10000) / 100 : 10;
}

/** Rate editor + platform-wide deduction totals (admin overview and commission tab). */
export function CommissionOverview({ summary }: { summary: CommissionSummary | null }) {
  if (!summary) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-200 bg-white p-4 text-sm text-neutral-500">
        ยังโหลดข้อมูลค่าคอมมิชชันไม่ได้ (ตรวจว่ารัน docs/migration-commission.sql แล้ว)
      </p>
    );
  }

  const ratePercent = commissionPercent(summary);
  const tiles = [
    {
      label: 'หักคอมมิชชันแล้วทั้งหมด',
      value: formatBaht(summary.commission_total),
      tone: 'text-orange-600',
      hint: `จาก ${summary.completed_orders.toLocaleString()} ออเดอร์ที่สำเร็จ`,
    },
    {
      label: 'หักใน 30 วันล่าสุด',
      value: formatBaht(summary.commission_30d),
      tone: 'text-orange-600',
      hint: `จากยอดขาย ${formatBaht(summary.gross_30d)}`,
    },
    {
      label: 'ยอดขายสินค้ารวม',
      value: formatBaht(summary.gross),
      tone: 'text-neutral-900',
      hint: 'ไม่รวมค่าจัดส่งของไรเดอร์',
    },
    {
      label: 'สุทธิที่ร้านค้าได้รับ',
      value: formatBaht(summary.net_to_stores),
      tone: 'text-forest-800',
      hint: 'ยอดขาย − คอมมิชชัน',
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div className="rounded-2xl border border-forest-200 bg-forest-50/60 p-4 shadow-sm">
        <p className="flex items-center gap-1 text-xs font-medium text-neutral-500">
          <Percent className="h-3.5 w-3.5" /> อัตราปัจจุบัน
        </p>
        <p className="mt-1 text-2xl font-extrabold text-forest-900">{ratePercent}%</p>
        <div className="mt-2">
          <CommissionRateForm ratePercent={ratePercent} />
        </div>
      </div>
      {tiles.map((t) => (
        <div key={t.label} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-neutral-500">{t.label}</p>
          <p className={`mt-1 text-2xl font-extrabold ${t.tone}`}>{t.value}</p>
          <p className="mt-1 text-xs text-neutral-500">{t.hint}</p>
        </div>
      ))}
    </div>
  );
}
