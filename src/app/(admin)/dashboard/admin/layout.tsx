import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getUserProfile } from '@/lib/actions/auth';
import { AdminNav } from '@/components/admin/AdminNav';
import { PersistentUserRoleChart } from '@/components/admin/PersistentUserRoleChart';
import { getAllUsers } from '@/lib/queries/admin';
import { PageHeader } from '@/components/ui/PageHeader';
import { ShieldCheck } from 'lucide-react';

/**
 * Admin workspace guard (layer 2 of SKILL.md §2). Middleware already blocks
 * non-admin roles at the edge; this re-checks on render.
 */
export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getUserProfile();
  if (!session) redirect('/login?next=/dashboard/admin');
  if (session.profile?.suspended) redirect('/suspended');
  if (session.profile?.role !== 'admin') redirect('/');

  const allUsers = await getAllUsers();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-4">
        <PageHeader
          icon={ShieldCheck}
          title="แดชบอร์ดแอดมิน"
          subtitle="ตรวจสอบยืนยันบัญชีและติดตามภาพรวมแพลตฟอร์ม"
        />
      </div>
      <AdminNav />
      {/* Rendered here (not per-page) so it stays mounted across
          /users, /stores, /riders navigations and its color emphasis can
          transition smoothly instead of hard-cutting on every route change. */}
      <Suspense fallback={null}>
        <div className="mt-6">
          <PersistentUserRoleChart users={allUsers} />
        </div>
      </Suspense>
      <div className="mt-6">{children}</div>
    </div>
  );
}
