import Link from 'next/link';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ModerationTable } from '@/components/admin/ModerationTable';
import { UserSuspendToggle } from '@/components/admin/UserSuspendToggle';
import { StoreSalesChart } from '@/components/admin/StoreSalesChart';
import { getAllUsers, getStoreSalesReport } from '@/lib/queries/admin';
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
  searchParams: { role?: string };
}) {
  const role = searchParams.role && ROLE_LABEL[searchParams.role] ? searchParams.role : undefined;
  const [allUsers, salesReport] = await Promise.all([getAllUsers(), getStoreSalesReport()]);
  const users = role ? allUsers.filter((u) => u.role === role) : allUsers;

  return (
    <div className="space-y-4">
      <StoreSalesChart report={salesReport} />

      <div className="flex items-center gap-2">
        <SectionTitle>
          {role ? `${ROLE_LABEL[role]} (${users.length})` : `ผู้ใช้ทั้งหมด (${users.length})`}
        </SectionTitle>
        {role && (
          <Link
            href="/dashboard/admin/users"
            className="flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-200"
          >
            ล้างตัวกรอง <X className="h-3 w-3" />
          </Link>
        )}
      </div>
      <ModerationTable
        headers={['ชื่อ', 'บทบาท', 'อีเมล', 'เบอร์โทร', 'วันที่สมัคร', 'สถานะ', '']}
      >
        {users.map((user) => (
          <tr key={user.id}>
            <td className="px-4 py-3 font-medium text-neutral-900">{user.full_name}</td>
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
          </tr>
        ))}
      </ModerationTable>
    </div>
  );
}
