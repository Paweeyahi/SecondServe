import { Clock } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/Badge';

/**
 * Relative expiry indicator. Counts down in hours/minutes inside the last
 * day -- the urgency is the selling point of near-expiry food.
 */
export function ExpiryBadge({ expiryDate }: { expiryDate: string }) {
  const ms = new Date(expiryDate).getTime() - Date.now();
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let label: string;
  let variant: BadgeProps['variant'];

  if (ms <= 0) {
    label = 'หมดอายุแล้ว';
    variant = 'danger';
  } else if (minutes < 60) {
    label = `เหลือ ${minutes} นาที`;
    variant = 'danger';
  } else if (hours < 24) {
    label = `เหลือ ${hours} ชม.`;
    variant = hours < 6 ? 'danger' : 'warning';
  } else {
    label = `เหลือ ${days} วัน`;
    variant = days <= 3 ? 'warning' : 'forest';
  }

  return (
    <Badge variant={variant} size="sm" className="gap-1 shadow-sm">
      <Clock className="h-3 w-3" />
      {label}
    </Badge>
  );
}
