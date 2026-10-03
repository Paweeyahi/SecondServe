'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { UserRoleChart } from './UserRoleChart';
import type { AdminUserRow } from '@/lib/queries/admin';

/**
 * Lives in the (admin) layout (not each page) so it's the same mounted
 * component across /users, /stores, /riders navigations -- only its
 * `activeRole` prop changes, so the color swap in UserRoleChart can
 * transition instead of hard-cutting on every route change.
 */
export function PersistentUserRoleChart({ users }: { users: AdminUserRow[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  let activeRole: string | undefined;
  if (pathname.startsWith('/dashboard/admin/stores')) activeRole = 'store';
  else if (pathname.startsWith('/dashboard/admin/riders')) activeRole = 'rider';
  else if (pathname.startsWith('/dashboard/admin/users')) {
    activeRole = searchParams.get('role') ?? undefined;
  }

  return <UserRoleChart users={users} activeRole={activeRole} />;
}
