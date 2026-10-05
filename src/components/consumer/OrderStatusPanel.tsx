'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatusTimeline } from '@/components/shared/StatusTimeline';
import { ORDER_STATUS_LABELS, type DeliveryType, type OrderStatus } from '@/types/order';

interface OrderStatusPanelProps {
  orderId: string;
  orderCode: string;
  initialStatus: OrderStatus;
  deliveryType: DeliveryType;
}

/** Live-updates via Supabase Realtime; the DB is the single source of truth (no polling). */
export function OrderStatusPanel({
  orderId,
  orderCode,
  initialStatus,
  deliveryType,
}: OrderStatusPanelProps) {
  const [status, setStatus] = useState<OrderStatus>(initialStatus);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      // The browser client loads its session from cookies asynchronously. Joining
      // before that sends no user JWT, so Realtime evaluates RLS as anon and
      // silently drops every orders event -- hand it the token first.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) await supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel(`order-status-${orderId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
          (payload) => {
            const next = (payload.new as { status?: OrderStatus }).status;
            if (next) setStatus(next);
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [orderId]);

  const cancelled = status === 'cancelled';

  return (
    <>
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-forest-200 bg-forest-50/60 p-4">
        {cancelled ? (
          <XCircle className="h-6 w-6 flex-shrink-0 text-red-600" />
        ) : (
          <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-forest-700" />
        )}
        <div>
          <p className="font-semibold text-forest-900">
            {cancelled ? 'คำสั่งซื้อถูกยกเลิก' : 'รับคำสั่งซื้อแล้ว'}
          </p>
          <p className="text-xs text-forest-700">หมายเลขออเดอร์ #{orderCode}</p>
        </div>
        <Badge variant={cancelled ? 'danger' : 'forest'} size="md" className="ml-auto">
          {ORDER_STATUS_LABELS[status]}
        </Badge>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">ความคืบหน้าออเดอร์</CardTitle>
        </CardHeader>
        <CardContent>
          <StatusTimeline status={status} deliveryType={deliveryType} />
        </CardContent>
      </Card>
    </>
  );
}
