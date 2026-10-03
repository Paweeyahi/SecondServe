import type { ReactNode } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export function MetricCard({
  label,
  value,
  icon,
  hint,
  href,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  hint?: string;
  /** When set, the whole card links to the detail page for this metric. */
  href?: string;
}) {
  const card = (
    <Card hoverEffect={Boolean(href)} className={href ? 'h-full cursor-pointer' : undefined}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-500">{label}</span>
          {icon}
        </div>
        <CardTitle className="text-3xl font-extrabold">{value}</CardTitle>
      </CardHeader>
      {hint && (
        <CardContent>
          <p className="text-xs text-neutral-500">{hint}</p>
        </CardContent>
      )}
    </Card>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {card}
    </Link>
  ) : (
    card
  );
}
