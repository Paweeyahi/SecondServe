import Link from 'next/link';
import { ChevronRight, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ModerationTable } from '@/components/admin/ModerationTable';
import { UserSuspendToggle } from '@/components/admin/UserSuspendToggle';
import { getAllUsers } from '@/lib/queries/admin';
import { SectionTitle } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

const ROLE_LABEL: Record<string, string> = {
  consumer: 'ผู้บริโภค',
  store: 'ร้านค้า',
  rider: 'ไรเดอร์',
  admin: 'แอดมิน',
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { role?: string; q?: string };
}) {
  const role = searchParams.role && ROLE_LABEL[searchParams.role] ? searchParams.role : undefined;
  const q = (searchParams.q ?? '').trim().toLowerCase();
  const allUsers = await getAllUsers();
  const users = allUsers.filter(
    (u) =>
      (!role || u.role === role) &&
      (!q ||
        u.full_name.toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q) ||
        u.phone.includes(q))
  );

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-center gap-2" action="/dashboard/admin/users">
        {role && <input type="hidden" name="role" value={role} />}
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            name="q"
            defaultValue={searchParams.q ?? ''}
            placeholder="ค้นหาชื่อ อีเมล หรือเบอร์โทร"
            className="w-full rounded-xl border border-neutral-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-200"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl bg-forest-800 px-4 py-2 text-sm font-medium text-white hover:bg-forest-900"
        >
          ค้นหา
        </button>
      </form>

      <div className="flex items-center gap-2">
        <SectionTitle>
          {role ? `${ROLE_LABEL[role]} (${users.length})` : `ผู้ใช้ทั้งหมด (${users.length})`}
        </SectionTitle>
        {(role || q) && (
          <Link
            href="/dashboard/admin/users"
            className="flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-200"
          >
            ล้างตัวกรอง <X className="h-3 w-3" />
          </Link>
        )}
      </div>
      <ModerationTable
        headers={['ชื่อ', 'บทบาท', 'อีเมล', 'เบอร์โทร', 'วันที่สมัคร', 'สถานะ', '', '']}
      >
        {users.map((user) => (
          <tr key={user.id}>
            <td className="px-4 py-3 font-medium text-neutral-900">
              <Link href={`/dashboard/admin/users/${user.id}`} className="hover:text-forest-800 hover:underline">
                {user.full_name}
              </Link>
            </td>
            <td className="px-4 py-3">
              <Badge variant={user.role} size="sm">
                {ROLE_LABEL[user.role]}
              </Badge>
            </td>
            <td className="px-4 py-3 text-neutral-600">{user.email ?? '-'}</td>
            <td className="px-4 py-3 text-neutral-600">{user.phone}</td>
            <td className="px-4 py-3 text-neutral-600">
              {new Date(user.created_at).toLocaleDateString('th-TH', {
                dateStyle: 'medium',
              })}
            </td>
            <td className="px-4 py-3">
              {user.suspended ? (
                <Badge variant="danger" size="sm">
                  ถูกระงับ
                </Badge>
              ) : (
                <Badge variant="forest" size="sm">
                  ปกติ
                </Badge>
              )}
            </td>
            <td className="px-4 py-3">
              <UserSuspendToggle userId={user.id} suspended={user.suspended} />
            </td>
            <td className="px-4 py-3">
              <Link
                href={`/dashboard/admin/users/${user.id}`}
                className="inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-medium text-forest-800 hover:underline"
              >
                ดูข้อมูล <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </td>
          </tr>
        ))}
      </ModerationTable>
    </div>
  );
}
