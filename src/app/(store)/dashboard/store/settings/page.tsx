import { AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { StoreProfileForm } from '@/components/store/StoreProfileForm';
import { getCurrentStore } from '@/lib/queries/store';
import { SectionTitle } from '@/components/ui/PageHeader';

export default async function StoreSettingsPage() {
  const store = await getCurrentStore();

  if (!store) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-red-700">
          <AlertCircle className="h-5 w-5" />
          ไม่พบข้อมูลร้านค้า กรุณาติดต่อผู้ดูแลระบบ
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <SectionTitle>ตั้งค่าร้านค้า</SectionTitle>
      <StoreProfileForm store={store} />
    </div>
  );
}
