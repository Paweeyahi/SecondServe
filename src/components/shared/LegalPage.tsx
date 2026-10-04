import type { ReactNode } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PRIVACY_VERSION } from '@/lib/legal';

/** Shared shell for /privacy and /terms: header + prose. */
export function LegalPage({
  title,
  icon,
  children,
}: {
  title: string;
  icon: Parameters<typeof PageHeader>[0]['icon'];
  children: ReactNode;
}) {
  const updated = new Date(`${PRIVACY_VERSION}T00:00:00Z`).toLocaleDateString('th-TH', {
    dateStyle: 'long',
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader icon={icon} title={title} subtitle={`ปรับปรุงล่าสุด ${updated}`} />

      <article className="space-y-6 rounded-2xl border border-neutral-200 bg-white p-6 text-sm leading-relaxed text-neutral-700 shadow-sm sm:p-8 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-forest-900 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
        {children}
      </article>
    </div>
  );
}
