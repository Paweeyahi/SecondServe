import { Check } from 'lucide-react';
import { ORDER_STATUS_LABELS, type DeliveryType, type OrderStatus } from '@/types/order';

const PICKUP_STEPS: OrderStatus[] = ['pending', 'confirmed', 'ready', 'completed'];
const DELIVERY_STEPS: OrderStatus[] = [
  'pending',
  'confirmed',
  'ready',
  'rider_assigned',
  'picked_up',
  'delivering',
  'completed',
];

interface StatusTimelineProps {
  status: OrderStatus;
  deliveryType: DeliveryType;
}

export function StatusTimeline({ status, deliveryType }: StatusTimelineProps) {
  if (status === 'cancelled') {
    return (
      <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
        คำสั่งซื้อนี้ถูกยกเลิกแล้ว
      </div>
    );
  }

  const steps = deliveryType === 'delivery' ? DELIVERY_STEPS : PICKUP_STEPS;
  const currentIndex = steps.indexOf(status);

  return (
    <ol>
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        const isLast = i === steps.length - 1;
        return (
          <li key={step} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                  done
                    ? 'border-forest-600 bg-forest-600 text-white'
                    : active
                      ? 'border-forest-600 bg-white text-forest-700'
                      : 'border-neutral-200 bg-white text-neutral-300'
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              {!isLast && (
                <span
                  className={`w-0.5 flex-1 ${done ? 'bg-forest-600' : 'bg-neutral-200'}`}
                  style={{ minHeight: '1.25rem' }}
                />
              )}
            </div>
            <p
              className={`pb-5 text-sm ${
                active
                  ? 'font-semibold text-forest-800'
                  : done
                    ? 'text-neutral-500'
                    : 'text-neutral-400'
              }`}
            >
              {ORDER_STATUS_LABELS[step]}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
