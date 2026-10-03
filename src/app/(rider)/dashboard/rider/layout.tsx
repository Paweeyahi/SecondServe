import { redirect } from 'next/navigation';
import { getUserProfile } from '@/lib/actions/auth';
import { RiderNav } from '@/components/rider/RiderNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { Bike } from 'lucide-react';

/**
 * Rider workspace guard (layer 2 of SKILL.md §2). Middleware already blocks
 * non-rider roles at the edge; this re-checks on render.
 */
export default async function RiderDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getUserProfile();
  if (!session) redirect('/login?next=/dashboard/rider');
  if (session.profile?.suspended) redirect('/suspended');
  if (session.profile?.role !== 'rider') redirect('/');

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-4">
        <PageHeader
          icon={Bike}
          title="แดชบอร์ดไรเดอร์"
          subtitle="รับงานจัดส่งและติดตามสถานะรอบส่งของคุณ"
        />
      </div>
      <RiderNav />
      <div className="mt-6">{children}</div>
    </div>
  );
}
