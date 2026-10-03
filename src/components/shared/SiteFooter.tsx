import Image from 'next/image';
import Link from 'next/link';
import { getUserProfile } from '@/lib/actions/auth';
import type { UserRole } from '@/types/roles';

const EXPLORE = {
    title: 'สำรวจ',
    links: [
      { href: '/', label: 'หน้าแรก' },
      { href: '/products', label: 'ค้นหาสินค้าใกล้หมดอายุ' },
      { href: '/shares', label: 'ส่งต่ออาหารชุมชน' },
    ],
};

/** Sign-up links for visitors; logged-in users get their own shortcuts. */
const JOIN = {
    title: 'ร่วมกับเรา',
    links: [
      { href: '/register', label: 'สมัครเป็นผู้ซื้อ' },
      { href: '/register', label: 'ลงทะเบียนร้านค้า' },
      { href: '/register', label: 'สมัครเป็นไรเดอร์' },
      { href: '/login', label: 'เข้าสู่ระบบ' },
    ],
};

const ACCOUNT_LINKS: Record<UserRole, { href: string; label: string }[]> = {
  consumer: [
    { href: '/account', label: 'บัญชีของฉัน' },
    { href: '/orders', label: 'ออเดอร์ของฉัน' },
    { href: '/claims', label: 'ของบริจาคที่ขอรับ' },
  ],
  store: [
    { href: '/dashboard/store', label: 'แดชบอร์ดร้านค้า' },
    { href: '/dashboard/store/orders', label: 'ออเดอร์ร้านค้า' },
  ],
  rider: [
    { href: '/dashboard/rider', label: 'แดชบอร์ดไรเดอร์' },
    { href: '/dashboard/rider/jobs', label: 'Job Pool' },
  ],
  admin: [{ href: '/dashboard/admin', label: 'แดชบอร์ดแอดมิน' }],
};

export async function SiteFooter() {
  const session = await getUserProfile();
  const role = session?.profile?.role;
  const COLUMNS = [
    EXPLORE,
    session ? { title: 'บัญชีของฉัน', links: ACCOUNT_LINKS[role ?? 'consumer'] } : JOIN,
  ];

  return (
    <footer className="border-t border-forest-100 bg-forest-900 text-forest-100">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-4 lg:px-8">
        <div className="space-y-3 md:col-span-2">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="relative h-12 w-12 rounded-xl bg-white p-1">
              <Image src="/logoSS.png" alt="" fill sizes="48px" className="object-contain p-1" />
            </div>
            <div>
              <p className="text-lg font-black leading-none text-white">
                Second<span className="text-leaf-500">Serve</span>
              </p>
              <p className="text-[11px] uppercase tracking-wider text-forest-300">
                More Than An Expiry Date
              </p>
            </div>
          </Link>
          <p className="max-w-sm text-sm leading-relaxed text-forest-100/80">
            แพลตฟอร์มส่งต่อสินค้าใกล้หมดอายุ เชื่อมร้านค้า ผู้บริโภค และไรเดอร์ในชุมชน
            ให้ของดีที่ยังมีคุณค่าได้ไปต่อ แทนการถูกทิ้ง
          </p>
        </div>

        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="mb-3 text-sm font-semibold text-white">{col.title}</p>
            <ul className="space-y-2 text-sm">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-forest-100/80 transition-colors hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-forest-300 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} SecondServe · คุณค่ามีมากกว่าวันหมดอายุ
        </p>
      </div>
    </footer>
  );
}
