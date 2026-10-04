import { redirect } from 'next/navigation';
import { getUserProfile } from '@/lib/actions/auth';
import { getCurrentStore } from '@/lib/queries/store';
import { getPendingOrderCount } from '@/lib/queries/store-orders';
import { getReservedClaimCount } from '@/lib/queries/shares';
import { StoreNav } from '@/components/store/StoreNav';
import { PageHeader } from '@/components/ui/PageHeader';
import { StoreLogo } from '@/components/shared/StoreLogo';
import { Store } from 'lucide-react';

export const dynamic = 'force-dynamic';

/**
 * Store workspace guard (layer 2 of SKILL.md §2). Middleware already blocks
 * non-store roles at the edge; this re-checks on render and loads the store row.
 */
export default async function StoreDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getUserProfile();
  if (!session) redirect('/login?next=/dashboard/store');
  if (session.profile?.suspended) redirect('/suspended');
  if (session.profile?.role !== 'store') redirect('/');

  const store = await getCurrentStore();
  const [pendingOrderCount, reservedClaimCount] = store
    ? await Promise.all([getPendingOrderCount(store.id), getReservedClaimCount(store.id)])
    : [0, 0];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-4">
        <PageHeader
          icon={Store}
          avatar={
            store?.logo_url ? (
              <StoreLogo name={store.name} logoUrl={store.logo_url} size="md" className="ring-2 ring-white/40" />
            ) : undefined
          }
          title={store?.name ?? 'ร้านค้าของฉัน'}
          subtitle="ศูนย์จัดการสินค้าใกล้หมดอายุ"
        />
      </div>
      <StoreNav pendingOrderCount={pendingOrderCount} reservedClaimCount={reservedClaimCount} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
