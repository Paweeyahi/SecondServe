import type { DailyRevenue } from '@/lib/queries/store-dashboard';

// Categorical slot 1 (dataviz reference palette) -- one series, so one hue,
// matching the admin StoreSalesChart. The app is light-theme only.
const BAR_COLOR = '#2a78d6';
const PLOT_HEIGHT = 160;

function formatBaht(n: number): string {
  return `฿${n.toLocaleString('th-TH', { maximumFractionDigits: 0 })}`;
}

function formatDay(date: string, opts: Intl.DateTimeFormatOptions): string {
  // date is YYYY-MM-DD (Bangkok); noon UTC keeps it on the same calendar day.
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok',
    ...opts,
  });
}

/** Rounds the axis max up to a readable step so gridline labels are clean. */
function niceMax(value: number): number {
  if (value <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * magnitude >= value) ?? 10;
  return step * magnitude;
}

export function StoreRevenueChart({ daily }: { daily: DailyRevenue[] }) {
  const max = niceMax(Math.max(...daily.map((d) => d.revenue)));
  const ticks = [max, max / 2, 0];
  const total = daily.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-900">ยอดขายรายวัน 14 วันล่าสุด</h3>
        <span className="text-xs text-neutral-500">รวม {formatBaht(total)}</span>
      </div>

      {total === 0 ? (
        <p className="py-10 text-center text-sm text-neutral-500">
          ยังไม่มีออเดอร์ที่สำเร็จในช่วง 14 วันที่ผ่านมา
        </p>
      ) : (
        <div className="flex gap-2">
          {/* Y axis labels */}
          <div
            className="relative w-12 flex-shrink-0 text-right text-[10px] text-neutral-400"
            style={{ height: PLOT_HEIGHT }}
            aria-hidden="true"
          >
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute right-0 -translate-y-1/2"
                style={{ top: `${(1 - t / max) * 100}%` }}
              >
                {formatBaht(t)}
              </span>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            {/* Plot */}
            <div className="relative" style={{ height: PLOT_HEIGHT }}>
              {ticks.map((t) => (
                <div
                  key={t}
                  className={`absolute inset-x-0 border-t ${t === 0 ? 'border-neutral-300' : 'border-neutral-100'}`}
                  style={{ top: `${(1 - t / max) * 100}%` }}
                  aria-hidden="true"
                />
              ))}
              <div className="absolute inset-0 flex items-end gap-0.5">
                {daily.map((d, i) => {
                  // Keep edge tooltips inside the card on narrow screens.
                  const tooltipAlign =
                    i < 3 ? 'left-0' : i >= daily.length - 3 ? 'right-0' : 'left-1/2 -translate-x-1/2';
                  const label = `${formatDay(d.date, { day: 'numeric', month: 'short' })}: ${formatBaht(d.revenue)} · ${d.orders} ออเดอร์`;
                  return (
                    <div
                      key={d.date}
                      tabIndex={0}
                      aria-label={label}
                      className="group relative flex h-full flex-1 items-end justify-center rounded outline-none hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-forest-600/40"
                    >
                      {d.revenue > 0 && (
                        <div
                          className="w-full max-w-[28px] rounded-t"
                          style={{
                            height: `${(d.revenue / max) * 100}%`,
                            backgroundColor: BAR_COLOR,
                          }}
                        />
                      )}
                      <div
                        role="tooltip"
                        className={`pointer-events-none absolute bottom-full z-10 mb-1 hidden ${tooltipAlign} whitespace-nowrap rounded-lg bg-neutral-900 px-2.5 py-1.5 text-[11px] text-white shadow-lg group-hover:block group-focus-visible:block`}
                      >
                        <p className="font-semibold">
                          {formatDay(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}
                        </p>
                        <p>
                          {formatBaht(d.revenue)} · {d.orders} ออเดอร์
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* X axis: day of month; month shown on the first day and on the 1st */}
            <div className="mt-1 flex gap-0.5 text-[10px] text-neutral-400" aria-hidden="true">
              {daily.map((d, i) => {
                const day = Number(d.date.slice(8));
                const showMonth = i === 0 || day === 1;
                return (
                  <span
                    key={d.date}
                    className={`flex-1 text-center ${i % 2 === 1 ? 'hidden sm:block' : ''}`}
                  >
                    {showMonth ? formatDay(d.date, { day: 'numeric', month: 'short' }) : day}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Table-view twin: exact figures for every day. */}
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-neutral-500 hover:text-neutral-800">
          ดูเป็นตาราง
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-neutral-500">
                <th className="py-1.5">วันที่</th>
                <th className="py-1.5 text-right">ออเดอร์สำเร็จ</th>
                <th className="py-1.5 text-right">ยอดขาย</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {[...daily].reverse().map((d) => (
                <tr key={d.date}>
                  <td className="py-1.5 text-neutral-800">
                    {formatDay(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}
                  </td>
                  <td className="py-1.5 text-right text-neutral-600">{d.orders}</td>
                  <td className="py-1.5 text-right font-medium text-neutral-900">
                    {formatBaht(d.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
