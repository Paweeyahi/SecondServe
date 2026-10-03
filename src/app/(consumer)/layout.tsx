import { redirect } from 'next/navigation';
import { getUserProfile } from '@/lib/actions/auth';

/**
 * Consumer workspace guard (checkout, orders, tracking).
 * Layer 2 of the two-layer role defense (SKILL.md §2) — `src/middleware.ts`
 * already blocks unauthenticated access at the edge; this re-checks on render
 * and additionally keeps store/rider/admin accounts out of consumer flows.
 */
export default async function ConsumerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getUserProfile();

  if (!session) redirect('/login?next=/orders');
  if (session.profile?.suspended) redirect('/suspended');
  if (session.profile && session.profile.role !== 'consumer') {
    redirect('/');
  }

  return <>{children}</>;
}
