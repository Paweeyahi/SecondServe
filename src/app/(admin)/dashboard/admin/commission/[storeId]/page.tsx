import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ModerationTable } from '@/components/admin/ModerationTable';
import { getStoreCommission } from '@/lib/queries/admin';
import { SectionTitle } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

function formatBaht(n: number): string {
  const v = Number(n);
  const frac = Number.isInteger(v) ? 0 : 2;
  return `฿${v.toLocaleString('th-TH', { minimumFractionDigits: frac, maximumFractionDigits: frac })}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
}

export default async function AdminStoreCommissionPage({ params }: { params: { storeId: string } }) {
  const data = await getStoreCommission(params.storeId);
  if (!data) notFound();
  const { store, totals, monthly, orders } = data;

  const tiles = [
    { label: 'ออเดอร์สำเร็จ', value: Number(totals.orders).toLocaleString(), tone: 'text-neutral-900' },
    { label: 'ยอดขายสินค้า', value: formatBaht(totals.gross), tone: 'text-neutral-900' },
    { label: 'ถูกหักคอมมิชชัน', value: `−${formatBaht(totals.commission)}`, tone: 'text-orange-600' },
    { label: 'สุทธิของร้าน', value: formatBaht(totals.net), tone: 'text-forest-800' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Link
            href="/dashboard/admin/commission"
            className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-forest-800"
          >
            <ArrowLeft className="h-4 w-4" /> ค่าคอมมิชชันทุกร้าน
          </Link>
          <h2 className="flex items-center gap-2 text-xl font-bold text-neutral-900">
            {store.name}
            <Badge variant={store.verified ? 'forest' : 'warning'} size="sm">
              {store.verified ? 'ยืนยันแล้ว' : 'รอยืนยัน'}
            </Badge>
          </h2>
          <p className="text-sm text-neutral-500">
            เจ้าของร้าน{' '}
            <Link href={`/dashboard/admin/users/${store.owner_id}`} className="text-forest-800 hover:underline">
              {store.owner_name}
            </Link>{' '}
            · โทร {store.phone}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-neutral-500">{t.label}</p>
            <p className={`mt-1 text-2xl font-extrabold ${t.tone}`}>{t.value}</p>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <SectionTitle>สรุปรายเดือน</SectionTitle>
        {monthly.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-200 bg-white p-4 text-sm text-neutral-500">
            ร้านนี้ยังไม่มีออเดอร์ที่สำเร็จ
          </p>
        ) : (
          <ModerationTable headers={['เดือน', 'ออเดอร์', 'ยอดขายสินค้า', 'ถูกหักคอมมิชชัน', 'สุทธิของร้าน']}>
            {monthly.map((m) => (
              <tr key={m.month}>
                <td className="px-4 py-3 font-medium text-neutral-900">{monthLabel(m.month)}</td>
                <td className="px-4 py-3 text-right text-neutral-600">{Number(m.orders)}</td>
                <td className="px-4 py-3 text-right">{formatBaht(m.gross)}</td>
                <td className="px-4 py-3 text-right font-semibold text-orange-600">−{formatBaht(m.commission)}</td>
                <td className="px-4 py-3 text-right font-medium text-forest-800">
                  {formatBaht(Number(m.gross) - Number(m.commission))}
                </td>
              </tr>
            ))}
          </ModerationTable>
        )}
      </section>

      {orders.length > 0 && (
        <section className="space-y-3">
          <SectionTitle subtitle="ทุกออเดอร์ที่สำเร็จ และอัตราที่ใช้ ณ เวลาสั่งซื้อ (แสดงล่าสุด 200 รายการ)">
            ออเดอร์ที่ถูกหักคอมมิชชัน
          </SectionTitle>
          <ModerationTable headers={['วันที่', 'ออเดอร์', 'วิธีรับ', 'ยอดขายสินค้า', 'อัตรา', 'ถูกหัก', 'สุทธิ']}>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="whitespace-nowrap px-4 py-3 text-neutral-600">
                  {new Date(o.created_at).toLocaleString('th-TH', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'Asia/Bangkok',
                  })}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-neutral-700">#{o.id.slice(0, 8).toUpperCase()}</td>
                <td className="px-4 py-3 text-neutral-600">{o.delivery_type === 'delivery' ? 'จัดส่ง' : 'รับเอง'}</td>
                <td className="px-4 py-3 text-right">{formatBaht(o.subtotal)}</td>
                <td className="px-4 py-3 text-right text-neutral-600">
                  {Math.round(Number(o.commission_rate) * 10000) / 100}%
                </td>
                <td className="px-4 py-3 text-right font-semibold text-orange-600">−{formatBaht(o.commission_amount)}</td>
                <td className="px-4 py-3 text-right font-medium text-forest-800">{formatBaht(o.net)}</td>
              </tr>
            ))}
          </ModerationTable>
        </section>
      )}
    </div>
  );
}
