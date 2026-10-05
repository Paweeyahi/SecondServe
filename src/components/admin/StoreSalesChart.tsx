import type { StoreSalesRow } from '@/lib/queries/admin';

// Categorical slot 1 -- one series, nominal categories (store names have no
// natural order), so every bar shares this one hue instead of a value-ramp.
const BAR_COLOR = '#2a78d6';

function formatCurrency(n: number): string {
  return `฿${n.toLocaleString('th-TH', { maximumFractionDigits: 0 })}`;
}

export function StoreSalesChart({
  report,
  ratePercent,
}: {
  report: StoreSalesRow[];
  /** Current platform rate, for the caption only -- each order keeps its own. */
  ratePercent?: number;
}) {
  const withSales = report.filter((r) => r.revenue > 0);
  const maxRevenue = Math.max(...withSales.map((r) => r.revenue), 1);
  const totalCommission = report.reduce((s, r) => s + r.commission, 0);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-900">
          ยอดขายและค่าคอมมิชชันแยกตามร้านค้า
        </h3>
        <span className="text-xs text-neutral-500">
          หักคอมมิชชันแล้วรวม {formatCurrency(totalCommission)}
          {ratePercent !== undefined && ` · อัตราปัจจุบัน ${ratePercent}%`}
        </span>
      </div>

      {withSales.length === 0 ? (
        <p className="text-sm text-neutral-500">ยังไม่มีออเดอร์ที่จัดส่งสำเร็จ</p>
      ) : (
        <div className="space-y-3">
          {withSales.map((row) => (
            <div key={row.store_id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-neutral-800">{row.store_name}</span>
                <span className="text-neutral-600">{formatCurrency(row.revenue)}</span>
              </div>
              <div className="h-3 w-full rounded-full bg-neutral-100">
                <div
                  className="h-3 rounded-full"
                  style={{
                    width: `${(row.revenue / maxRevenue) * 100}%`,
                    backgroundColor: BAR_COLOR,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table-view twin: exact figures, including stores with zero sales. */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <th className="py-1.5">ร้านค้า</th>
              <th className="py-1.5 text-right">ออเดอร์สำเร็จ</th>
              <th className="py-1.5 text-right">จำนวนที่ขายได้</th>
              <th className="py-1.5 text-right">ยอดขาย</th>
              <th className="py-1.5 text-right">ถูกหักคอมมิชชัน</th>
              <th className="py-1.5 text-right">สุทธิของร้าน</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {report.map((row) => (
              <tr key={row.store_id}>
                <td className="py-2 text-neutral-800">{row.store_name}</td>
                <td className="py-2 text-right text-neutral-600">{row.orders}</td>
                <td className="py-2 text-right text-neutral-600">{row.quantity_sold}</td>
                <td className="py-2 text-right font-medium text-neutral-900">
                  {formatCurrency(row.revenue)}
                </td>
                <td className="py-2 text-right text-orange-600">
                  −{formatCurrency(row.commission)}
                </td>
                <td className="py-2 text-right font-medium text-forest-800">
                  {formatCurrency(row.net)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
