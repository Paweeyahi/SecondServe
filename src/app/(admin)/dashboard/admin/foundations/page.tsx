import { Building2, MapPin, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { FoundationForm } from '@/components/admin/FoundationForm';
import { getAllFoundations } from '@/lib/queries/foundations';
import { SectionTitle } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default async function AdminFoundationsPage() {
  const foundations = await getAllFoundations();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle subtitle="ร้านค้าเลือกมอบสินค้าทั้งล็อตให้มูลนิธิที่เปิดรับบริจาคได้ มูลนิธิไม่ต้องมีบัญชีผู้ใช้">
          มูลนิธิ ({foundations.length})
        </SectionTitle>
        <FoundationForm />
      </div>

      {foundations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <Building2 className="h-10 w-10 text-neutral-300" />
            <p className="text-sm text-neutral-500">ยังไม่มีมูลนิธิในระบบ</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {foundations.map((f) => (
            <div
              key={f.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-neutral-900">{f.name}</p>
                  {f.active ? (
                    <Badge variant="forest" size="sm">
                      เปิดรับบริจาค
                    </Badge>
                  ) : (
                    <Badge variant="default" size="sm">
                      ปิดรับ
                    </Badge>
                  )}
                </div>
                {f.description && <p className="text-sm text-neutral-600">{f.description}</p>}
                <p className="flex flex-wrap gap-x-3 text-xs text-neutral-500">
                  {f.address && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {f.address}
                    </span>
                  )}
                  {f.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {f.phone}
                    </span>
                  )}
                </p>
              </div>
              <FoundationForm foundation={f} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
