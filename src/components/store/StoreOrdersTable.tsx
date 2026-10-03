import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { ORDER_STATUS_LABELS, type DeliveryType, type OrderStatus } from '@/types/order';
import type { StoreOrderListItem } from '@/lib/queries/store-orders';
import { ProductThumbs } from '@/components/shared/ProductThumbs';
import { StoreOrderActions } from './StoreOrderActions';

const STATUS_VARIANT: Record<OrderStatus, BadgeProps['variant']> = {
  pending: 'warning',
  confirmed: 'forest',
  ready: 'forest',
  rider_assigned: 'rider',
  picked_up: 'rider',
  delivering: 'rider',
  completed: 'default',
  cancelled: 'danger',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Store orders: a table from md up (status + next action inline), and a
 * card per order on phones so nothing needs sideways scrolling.
 */
export function StoreOrdersTable({ orders }: { orders: StoreOrderListItem[] }) {
  return (
    <>
      <ul className="space-y-3 md:hidden">
        {orders.map((order) => (
          <StoreOrderMobileCard key={order.id} order={order} />
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm md:block">
      <table className="w-full min-w-[1080px] text-sm">
        <thead className="bg-gradient-to-r from-forest-800 to-forest-700">
          <tr className="text-left text-xs font-semibold tracking-wide text-white">
            <th className="px-4 py-3">ออเดอร์</th>
            <th className="px-4 py-3">สินค้า</th>
            <th className="px-4 py-3">ลูกค้า</th>
            <th className="px-4 py-3">การรับสินค้า</th>
            <th className="px-4 py-3 text-right">ยอดรวม</th>
            <th className="px-4 py-3">สถานะ</th>
            <th className="px-4 py-3">ดำเนินการ</th>
            <th className="px-2 py-3">
              <span className="sr-only">รายละเอียด</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {orders.map((order) => {
            const status = order.status as OrderStatus;
            const href = `/dashboard/store/orders/${order.id}`;
            return (
              <tr
                key={order.id}
                className={`align-middle ${status === 'pending' ? 'bg-amber-50/50' : 'hover:bg-neutral-50'}`}
              >
                <td className="px-4 py-3">
                  <Link
                    href={href}
                    className="font-mono font-semibold text-neutral-900 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-500"
                  >
                    #{order.id.slice(0, 8).toUpperCase()}
                  </Link>
                  <p className="text-xs text-neutral-500">{formatDate(order.created_at)}</p>
                </td>
                <td className="px-4 py-3">
                  <ProductThumbs items={order.items} />
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-neutral-900">{order.consumer?.full_name ?? 'ลูกค้า'}</p>
                  <p className="text-xs text-neutral-500">{order.consumer?.phone ?? '-'}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" size="sm">
                    {order.delivery_type === 'delivery' ? 'จัดส่ง' : 'รับเองที่ร้าน'}
                  </Badge>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <p className="font-semibold text-neutral-900">
                    ฿{Number(order.total_amount).toLocaleString()}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[status]} size="sm" className="whitespace-nowrap">
                    {ORDER_STATUS_LABELS[status]}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <StoreOrderActions
                    orderId={order.id}
                    status={status}
                    deliveryType={order.delivery_type as DeliveryType}
                    className=""
                  />
                </td>
                <td className="px-2 py-3">
                  <Link
                    href={href}
                    aria-label={`ดูรายละเอียดออเดอร์ #${order.id.slice(0, 8).toUpperCase()}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}

function StoreOrderMobileCard({ order }: { order: StoreOrderListItem }) {
  const status = order.status as OrderStatus;
  const href = `/dashboard/store/orders/${order.id}`;
  return (
    <li
      className={`space-y-3 rounded-2xl border p-4 shadow-sm ${
        status === 'pending' ? 'border-amber-200 bg-amber-50/60' : 'border-neutral-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link href={href} className="font-mono font-semibold text-neutral-900 underline decoration-neutral-300 underline-offset-2">
            #{order.id.slice(0, 8).toUpperCase()}
          </Link>
          <p className="text-xs text-neutral-500">{formatDate(order.created_at)}</p>
        </div>
        <Badge variant={STATUS_VARIANT[status]} size="sm" className="whitespace-nowrap">
          {ORDER_STATUS_LABELS[status]}
        </Badge>
      </div>
      <ProductThumbs items={order.items} />
      <div className="flex items-end justify-between gap-2 text-sm">
        <div>
          <p className="font-medium text-neutral-900">{order.consumer?.full_name ?? 'ลูกค้า'}</p>
          <p className="text-xs text-neutral-500">
            {order.consumer?.phone ?? '-'} · {order.delivery_type === 'delivery' ? 'จัดส่ง' : 'รับเองที่ร้าน'}
          </p>
        </div>
        <p className="text-base font-bold text-neutral-900">฿{Number(order.total_amount).toLocaleString()}</p>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-neutral-100 pt-3">
        <StoreOrderActions
          orderId={order.id}
          status={status}
          deliveryType={order.delivery_type as DeliveryType}
          className=""
        />
        <Link href={href} className="flex flex-shrink-0 items-center text-sm font-medium text-forest-800">
          รายละเอียด <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </li>
  );
}