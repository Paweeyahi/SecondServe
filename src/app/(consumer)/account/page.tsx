import Link from 'next/link';
import { ChevronRight, HandHeart, Mail, Package, UserRound } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { ProfileForm } from '@/components/consumer/ProfileForm';
import { getUserProfile } from '@/lib/actions/auth';
import { getMyImpact } from '@/lib/queries/impact';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'บัญชีของฉัน — SecondServe' };

export default async function AccountPage() {
  // The (consumer) layout already guarantees a signed-in consumer.
  const session = await getUserProfile();
  const profile = session?.profile;
  const impact = session ? await getMyImpact(session.user.id) : null;
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('th-TH', { dateStyle: 'long' })
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        icon={UserRound}
        title="บัญชีของฉัน"
        subtitle={memberSince ? `สมาชิกตั้งแต่ ${memberSince}` : undefined}
      />

      {impact && (
        <section aria-label="ผลลัพธ์ของคุณ" className="grid grid-cols-3 gap-3">
          {[
            { value: impact.itemsSaved.toLocaleString(), label: 'ชิ้นที่ช่วยไม่ให้ถูกทิ้ง', tone: 'text-forest-800' },
            {
              value: `฿${impact.moneySaved.toLocaleString('th-TH', { maximumFractionDigits: 0 })}`,
              label: 'เงินที่ประหยัดได้',
              tone: 'text-orange-600',
            },
            { value: impact.claimsCollected.toLocaleString(), label: 'ชิ้นที่รับจากการแบ่งปัน', tone: 'text-forest-800' },
          ].map((t) => (
            <div key={t.label} className="rounded-2xl border border-forest-100 bg-forest-50 p-3 text-center sm:p-4">
              <p className={`text-xl font-extrabold sm:text-2xl ${t.tone}`}>{t.value}</p>
              <p className="mt-0.5 text-[11px] leading-tight text-neutral-600 sm:text-xs">{t.label}</p>
            </div>
          ))}
        </section>
      )}

      <Card>
        <CardContent className="flex items-center gap-3 p-4 text-sm">
          <Mail className="h-4 w-4 flex-shrink-0 text-neutral-400" />
          <div className="min-w-0">
            <p className="text-xs text-neutral-500">อีเมลที่ใช้เข้าสู่ระบบ (แก้ไขไม่ได้)</p>
            <p className="truncate font-medium text-neutral-900">{session?.user.email ?? '-'}</p>
          </div>
        </CardContent>
      </Card>

      <ProfileForm fullName={profile?.full_name ?? ''} phone={profile?.phone ?? ''} />

      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { href: '/orders', label: 'ออเดอร์ของฉัน', icon: Package },
          { href: '/claims', label: 'ของบริจาคที่ขอรับ', icon: HandHeart },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card hoverEffect>
              <CardContent className="flex items-center justify-between p-4">
                <span className="flex items-center gap-2 text-sm font-medium text-neutral-800">
                  <Icon className="h-4 w-4 text-forest-700" />
                  {label}
                </span>
                <ChevronRight className="h-4 w-4 text-neutral-400" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
