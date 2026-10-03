import Link from 'next/link';
import { ArrowUpRight, ChevronRight, MousePointerClick } from 'lucide-react';
import type { AdminUserRow } from '@/lib/queries/admin';

const ROLE_ORDER = ['consumer', 'store', 'rider', 'admin'] as const;

const ROLE_LABEL: Record<string, string> = {
  consumer: 'ผู้บริโภค',
  store: 'ร้านค้า',
  rider: 'ไรเดอร์',
  admin: 'แอดมิน',
};

// Where clicking each role should take the admin -- store/rider have their
// own moderation pages; consumer/admin only live in the users list. The
// donut's center is the odd one out -- it goes to the overview instead.
const ROLE_HREF: Record<string, string> = {
  consumer: '/dashboard/admin/users?role=consumer',
  store: '/dashboard/admin/stores',
  rider: '/dashboard/admin/riders',
  admin: '/dashboard/admin/users?role=admin',
};

// Categorical slots 1-4 from the validated default palette (dataviz skill),
// used in their documented order -- consumer/store/rider/admin each get a
// fixed hue so the color always means the same role.
const ROLE_COLOR: Record<string, string> = {
  consumer: '#2a78d6',
  store: '#eb6834',
  rider: '#1baf7a',
  admin: '#eda100',
};

// Emphasis form (dataviz skill): when one role is "the point," the rest
// recede to a shared de-emphasis gray instead of keeping their own hue.
const DEEMPHASIS_COLOR = '#c3c2b7';

const SIZE = 176;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 3;

export function UserRoleChart({
  users,
  activeRole,
}: {
  users: AdminUserRow[];
  /** The role this page is currently focused on, if any -- emphasized in the chart. */
  activeRole?: string;
}) {
  const total = users.length;
  const counts = ROLE_ORDER.map((role) => ({
    role,
    count: users.filter((u) => u.role === role).length,
  }));

  let cumulative = 0;
  const arcs = counts
    .filter((c) => c.count > 0)
    .map(({ role, count }) => {
      const length = (count / total) * CIRCUMFERENCE;
      const visible = Math.max(0, length - GAP);
      const start = cumulative + GAP / 2;
      cumulative += length;
      return { role, count, dasharray: `${visible} ${CIRCUMFERENCE - visible}`, dashoffset: -start };
    });

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-900">
          สัดส่วนผู้ใช้แต่ละประเภท ({total} คน)
          {activeRole && (
            <span className="ml-2 font-normal text-neutral-500">
              · กำลังดู: {ROLE_LABEL[activeRole]}
            </span>
          )}
        </h3>
        {total > 0 && (
          <span className="flex items-center gap-1 text-xs text-neutral-400">
            <MousePointerClick className="h-3.5 w-3.5" />
            คลิกเพื่อดูรายละเอียดแต่ละประเภท
          </span>
        )}
      </div>

      {total === 0 ? (
        <p className="text-sm text-neutral-500">ยังไม่มีผู้ใช้ในระบบ</p>
      ) : (
        <div className="flex flex-col-reverse items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
          {/* Table-view twin -- also doubles as the legend. */}
          <table className="w-full text-sm sm:max-w-xs">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <th className="py-1.5">ประเภท</th>
                <th className="py-1.5 text-right">จำนวน</th>
                <th className="py-1.5 text-right">สัดส่วน</th>
                <th className="py-1.5" aria-hidden />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {counts.map(({ role, count }) => {
                const isActive = activeRole === role;
                return (
                  <tr
                    key={role}
                    className={`transition-colors duration-300 ease-out ${
                      isActive ? 'bg-neutral-50' : ''
                    }`}
                  >
                    <td className="py-2">
                      <Link
                        href={ROLE_HREF[role]}
                        className={`group flex items-center gap-2 transition-colors duration-300 ease-out ${
                          isActive ? 'font-semibold text-neutral-900' : ''
                        }`}
                      >
                        <span
                          className="h-3 w-3 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: ROLE_COLOR[role] }}
                          aria-hidden
                        />
                        <span
                          className={`underline decoration-neutral-300 underline-offset-2 transition-colors duration-300 ease-out group-hover:decoration-neutral-500 ${
                            isActive ? 'text-neutral-900' : 'text-neutral-700'
                          }`}
                        >
                          {ROLE_LABEL[role]}
                        </span>
                      </Link>
                    </td>
                    <td
                      className={`py-2 text-right transition-colors duration-300 ease-out ${
                        isActive ? 'font-bold text-neutral-900' : 'font-medium text-neutral-900'
                      }`}
                    >
                      {count}
                    </td>
                    <td className="py-2 text-right text-neutral-500">
                      {total > 0 ? ((count / total) * 100).toFixed(1) : '0'}%
                    </td>
                    <td className="py-2 pl-1">
                      <Link href={ROLE_HREF[role]} aria-hidden tabIndex={-1}>
                        <ChevronRight className="h-4 w-4 text-neutral-300" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Donut -- each ring segment links to its role's page; the empty
              center links to the platform overview. */}
          <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
            <svg
              width={SIZE}
              height={SIZE}
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              className="-rotate-90"
            >
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="#f0efec"
                strokeWidth={STROKE}
              />
              {arcs.map(({ role, count, dasharray, dashoffset }) => (
                <Link
                  key={role}
                  href={ROLE_HREF[role]}
                  aria-label={`${ROLE_LABEL[role]}: ${count} คน`}
                >
                  <circle
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    stroke={
                      activeRole && activeRole !== role ? DEEMPHASIS_COLOR : ROLE_COLOR[role]
                    }
                    strokeWidth={STROKE}
                    strokeDasharray={dasharray}
                    strokeDashoffset={dashoffset}
                    className="cursor-pointer transition-colors duration-300 ease-out hover:opacity-80"
                  >
                    <title>{`${ROLE_LABEL[role]}: ${count} คน`}</title>
                  </circle>
                </Link>
              ))}
            </svg>

            <Link
              href="/dashboard/admin"
              title="ไปที่หน้าภาพรวม"
              className="group absolute inset-0 m-auto flex flex-col items-center justify-center rounded-full border border-dashed border-neutral-200 text-center transition-colors duration-300 ease-out hover:border-neutral-300 hover:bg-neutral-50"
              style={{ width: SIZE - STROKE * 2 - 8, height: SIZE - STROKE * 2 - 8 }}
            >
              <span className="text-2xl font-extrabold text-neutral-900">{total}</span>
              <span className="flex items-center gap-0.5 text-xs text-neutral-500 underline decoration-neutral-300 underline-offset-2 group-hover:decoration-neutral-500">
                ผู้ใช้ทั้งหมด
                <ArrowUpRight className="h-3 w-3" />
              </span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
