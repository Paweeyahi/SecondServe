import { Badge } from '@/components/ui/Badge';
import { ModerationTable } from '@/components/admin/ModerationTable';
import { StoreVerifyToggle } from '@/components/admin/StoreVerifyToggle';
import { getAllStores } from '@/lib/queries/admin';
import { SectionTitle } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default async function AdminStoresPage() {
  const stores = await getAllStores();

  return (
    <div className="space-y-4">
      <SectionTitle>ร้านค้าทั้งหมด ({stores.length})</SectionTitle>
      <ModerationTable headers={['ร้านค้า', 'เจ้าของ', 'ค่าจัดส่ง', 'สถานะ', '']}>
        {stores.map((store) => (
          <tr key={store.id}>
            <td className="px-4 py-3 font-medium text-neutral-900">{store.name}</td>
            <td className="px-4 py-3 text-neutral-600">{store.owner?.full_name ?? '-'}</td>
            <td className="px-4 py-3 text-neutral-600">
              ฿{Number(store.delivery_fee).toLocaleString()}
            </td>
            <td className="px-4 py-3">
              {store.verified ? (
                <Badge variant="forest" size="sm">
                  ยืนยันแล้ว
                </Badge>
              ) : (
                <Badge variant="warning" size="sm">
                  รอตรวจสอบ
                </Badge>
              )}
            </td>
            <td className="px-4 py-3">
              <StoreVerifyToggle storeId={store.id} verified={store.verified} />
            </td>
          </tr>
        ))}
      </ModerationTable>
    </div>
  );
}
