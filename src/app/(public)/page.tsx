import Image from 'next/image';
import Link from 'next/link';
import {
  ShoppingBag,
  Store,
  Bike,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Clock,
  HeartHandshake,
  HandHeart,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProductCard } from '@/components/consumer/ProductCard';
import { searchCatalog } from '@/lib/queries/catalog';
import { getCommunityShareStats, getPublicShares } from '@/lib/queries/shares';
import { getUserProfile } from '@/lib/actions/auth';

const FEATURED_LIMIT = 8;
const FEATURED_SHARES_LIMIT = 3;

export default async function HomePage() {
  const [{ products: featuredProducts }, session, shareStats, { shares: availableShares }] = await Promise.all([
    searchCatalog(
      { q: '', category: null, minPrice: null, maxPrice: null, exp: null, sort: 'expiry', near: null },
      { pageSize: FEATURED_LIMIT }
    ),
    getUserProfile(),
    getCommunityShareStats(),
    getPublicShares({ view: 'available', category: null, page: 1 }),
  ]);
  const featuredShares = availableShares.slice(0, FEATURED_SHARES_LIMIT);
  const canOrder = session?.profile?.role === 'consumer';
  // Logged-in visitors must not see sign-up/log-in CTAs: /register and /login
  // bounce authenticated users straight back here, so those buttons look dead.
  const isLoggedIn = !!session;
  const staffCta: Record<string, { href: string; label: string }> = {
    store: { href: '/dashboard/store', label: 'ไปที่ร้านของฉัน' },
    rider: { href: '/dashboard/rider', label: 'ไปที่แดชบอร์ดไรเดอร์' },
    admin: { href: '/dashboard/admin', label: 'ไปที่แดชบอร์ดแอดมิน' },
  };
  const homeCta = staffCta[session?.profile?.role ?? ''] ?? {
    href: '/products',
    label: 'เลือกซื้อสินค้าเลย',
  };

  return (
    <div className="space-y-16 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-forest-50/60 via-white to-neutral-50 pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-forest-200 bg-forest-100/70 px-4 py-1.5 text-xs font-semibold text-forest-800 shadow-sm mb-6">
            <Sparkles className="h-3.5 w-3.5 text-forest-700" />
            <span>More Than An Expiry Date. | คุณค่ามีมากกว่าวันหมดอายุ</span>
          </div>

          <h1 className="mx-auto max-w-4xl text-[3rem] font-black tracking-tight text-neutral-900 leading-[1.2]">
            แพลตฟอร์มส่งต่อสินค้าใกล้หมดอายุ <br />
            <span className="text-forest-800">เพื่อการบริโภคอย่างยั่งยืน</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-neutral-600 leading-relaxed">
            SecondServe เชื่อมโยงร้านค้า ผู้บริโภค และไรเดอร์ในชุมชนเข้าด้วยกัน 
            เพื่อลดขยะอาหาร (Zero Food Waste) ช่วยให้เข้าถึงสินค้าราคาประหยัด 
            พร้อมตัวเลือกรับเองที่ร้านหรือจัดส่งด่วนถึงบ้าน
          </p>

          {/* Quick Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href={isLoggedIn ? homeCta.href : '/register'}>
              <Button size="lg" variant="primary" rightIcon={<ArrowRight className="h-4 w-4" />}>
                {isLoggedIn ? homeCta.label : 'เริ่มต้นใช้งานฟรี'}
              </Button>
            </Link>
            <Link href="/shares">
              <Button
                size="lg"
                variant="outline"
                leftIcon={<HeartHandshake className="h-4 w-4 text-forest-700" />}
              >
                รับอาหารฟรีจากชุมชน
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Near-Expiry Products */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900">
              สินค้าวันนี้
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              ของดีราคาประหยัดจากร้านค้าในเครือข่าย ก่อนที่จะหมดอายุ
            </p>
          </div>
          <Link href="/products">
            <Button variant="outline" size="sm" rightIcon={<ArrowRight className="h-4 w-4" />}>
              ดูสินค้าทั้งหมด
            </Button>
          </Link>
        </div>

        {featuredProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center text-sm text-neutral-500">
            ยังไม่มีสินค้าที่กำลังขายในขณะนี้
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} canOrder={canOrder} />
            ))}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-extrabold text-forest-900 sm:text-3xl">ใช้งานง่ายใน 3 ขั้นตอน</h2>
          <p className="mt-1 text-sm text-neutral-500">ของดีราคาประหยัด ช่วยโลกไปพร้อมกัน</p>
        </div>
        <ol className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: ShoppingBag,
              title: 'เลือกของใกล้หมดอายุ',
              body: 'ค้นหาสินค้าลดราคาจากร้านใกล้คุณ ดูได้ทันทีว่าเหลือเวลาอีกเท่าไร',
            },
            {
              icon: Bike,
              title: 'รับเองหรือให้ไรเดอร์ส่ง',
              body: 'ไปรับที่ร้านฟรี หรือให้ไรเดอร์ในชุมชนส่งถึงบ้าน ชำระเงินปลายทาง',
            },
            {
              icon: HeartHandshake,
              title: 'ช่วยลดขยะอาหาร',
              body: 'ทุกชิ้นที่คุณซื้อคืออาหารที่ไม่ถูกทิ้ง ติดตามผลลัพธ์ของคุณได้ในหน้าบัญชี',
            },
          ].map(({ icon: Icon, title, body }, i) => (
            <li
              key={title}
              className="relative rounded-2xl border border-forest-100 bg-white p-6 shadow-sm"
            >
              <span className="absolute right-5 top-4 text-5xl font-black text-forest-100" aria-hidden="true">
                {i + 1}
              </span>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-forest-100 text-forest-800">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-forest-900">{title}</h3>
              <p className="mt-1 text-sm text-neutral-600">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Community Donation */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl border border-forest-200 bg-gradient-to-br from-forest-50 via-white to-emerald-50/60 p-6 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-5 lg:items-center">
            <div className="space-y-5 lg:col-span-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-forest-100 px-3 py-1 text-xs font-semibold text-forest-800">
                <HeartHandshake className="h-3.5 w-3.5" />
                ส่งต่ออาหารชุมชน
              </div>
              <h2 className="text-2xl font-extrabold leading-snug text-neutral-900 sm:text-3xl">
                อาหารดี ๆ ที่ไม่ควรถูกทิ้ง
                <br />
                <span className="text-forest-800">รับฟรีได้ที่ร้านใกล้คุณ</span>
              </h2>
              <p className="text-sm leading-relaxed text-neutral-600">
                ร้านค้าในเครือข่ายแบ่งสินค้าใกล้หมดอายุที่ยังดีอยู่ให้ชุมชนแทนการทิ้ง
                กดขอรับได้คนละไม่เกิน 5 ชิ้นต่อรายการ แล้วไปรับที่ร้าน ไม่มีค่าใช้จ่าย
              </p>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: shareStats.totalQuantity, label: 'ชิ้นที่ส่งต่อแล้ว' },
                  { value: shareStats.availableQuantity, label: 'ชิ้นรับได้ตอนนี้' },
                  { value: shareStats.storeCount, label: 'ร้านที่ร่วมแบ่งปัน' },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl bg-white/80 p-3 shadow-sm">
                    <p className="text-xl font-extrabold text-forest-900 sm:text-2xl">
                      {stat.value.toLocaleString()}
                    </p>
                    <p className="text-[11px] leading-tight text-forest-700 sm:text-xs">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>

              <Link href="/shares" className="inline-block">
                <Button
                  variant="primary"
                  leftIcon={<HandHeart className="h-4 w-4" />}
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  ดูของบริจาคทั้งหมด
                </Button>
              </Link>
            </div>

            <div className="lg:col-span-3">
              {featuredShares.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-forest-200 bg-white/70 p-10 text-center">
                  <HeartHandshake className="h-8 w-8 text-forest-300" />
                  <p className="text-sm text-neutral-500">
                    ตอนนี้ยังไม่มีของบริจาคที่รับได้ ลองกลับมาดูใหม่ภายหลัง
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  {featuredShares.map((share) => (
                    <Link
                      key={share.id}
                      href="/shares"
                      className="group flex gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm transition-all hover:border-forest-300 hover:shadow-md sm:flex-col lg:flex-row xl:flex-col"
                    >
                      <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-neutral-100 sm:aspect-[4/3] sm:h-auto sm:w-full lg:h-20 lg:w-20 lg:aspect-auto xl:aspect-[4/3] xl:h-auto xl:w-full">
                        {share.product?.image_url && (
                          <Image
                            src={share.product.image_url}
                            alt={share.product.name ?? ''}
                            fill
                            sizes="(min-width: 1280px) 220px, (min-width: 640px) 200px, 80px"
                            className="object-cover transition-transform group-hover:scale-105"
                          />
                        )}
                        <span className="absolute left-2 top-2 rounded-full bg-forest-800 px-2 py-0.5 text-[10px] font-bold text-white">
                          ฟรี
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-sm font-semibold text-neutral-900">
                          {share.product?.name ?? 'สินค้า'}
                        </p>
                        {share.store && (
                          <p className="flex items-center gap-1 truncate text-xs text-neutral-500">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            {share.store.name}
                          </p>
                        )}
                        <p className="text-xs font-medium text-forest-700">
                          เหลือ {share.remaining} จาก {share.quantity} ชิ้น
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 3 Core Roles Section -- a sign-up pitch, so only for logged-out visitors */}
      {!isLoggedIn && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-forest-900">
              ร่วมเป็นส่วนหนึ่งกับ SecondServe
            </h2>
            <p className="text-sm text-neutral-500 max-w-xl mx-auto">
              จะเป็นผู้ซื้อ ร้านค้า หรือไรเดอร์ ทุกคนช่วยให้อาหารดี ๆ ได้ไปต่อ
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Consumer Card */}
            <Card hoverEffect className="relative overflow-hidden border-t-4 border-t-emerald-600">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
                    <ShoppingBag className="h-6 w-6" />
                  </div>
                  <Badge variant="consumer">ผู้บริโภค</Badge>
                </div>
                <CardTitle className="mt-4">ผู้บริโภค (Consumer)</CardTitle>
                <CardDescription>
                  เข้าถึงของดีมีคุณภาพในราคาประหยัด
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-neutral-600">
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    <span>ค้นหาสินค้าใกล้หมดอายุลดราคาพิเศษ</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    <span>เลือกรับเองที่ร้าน (Self-Pickup) หรือให้ไรเดอร์ส่ง</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <HeartHandshake className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    <span>ร่วมรับอาหารส่งต่อฟรีจากโครงการชุมชน</span>
                  </li>
                </ul>
                <Link href="/register" className="block pt-2">
                  <Button variant="outline" size="sm" className="w-full">
                    สมัครเป็นผู้บริโภค
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Store Card */}
            <Card hoverEffect className="relative overflow-hidden border-t-4 border-t-amber-500">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
                    <Store className="h-6 w-6" />
                  </div>
                  <Badge variant="store">ร้านค้า</Badge>
                </div>
                <CardTitle className="mt-4">ร้านค้า (Store)</CardTitle>
                <CardDescription>
                  เปลี่ยนสินค้าใกล้หมดอายุเป็นโอกาสและรายได้
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-neutral-600">
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <span>ลงขายสินค้าใกล้หมดอายุได้สะดวกรวดเร็ว</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <span>จัดการสต็อกและวันหมดอายุแบบ Real-time</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <HeartHandshake className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <span>ระบบส่งต่ออาหารให้กลุ่มเปราะบาง (Donation)</span>
                  </li>
                </ul>
                <Link href="/register" className="block pt-2">
                  <Button variant="outline" size="sm" className="w-full">
                    ลงทะเบียนร้านค้า
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Rider Card */}
            <Card hoverEffect className="relative overflow-hidden border-t-4 border-t-sky-500">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-800">
                    <Bike className="h-6 w-6" />
                  </div>
                  <Badge variant="rider">ไรเดอร์</Badge>
                </div>
                <CardTitle className="mt-4">ไรเดอร์ (Rider)</CardTitle>
                <CardDescription>
                  รับงานจัดส่งสินค้าในชุมชน รายได้เสริมอิสระ
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-neutral-600">
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-sky-600 flex-shrink-0" />
                    <span>เข้าถึง Delivery Job Pool ในพื้นที่ใกล้เคียง</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-sky-600 flex-shrink-0" />
                    <span>รับงานอิสระ เลือกรอบเวลาที่สะดวกได้เอง</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-sky-600 flex-shrink-0" />
                    <span>ระบบตรวจสอบสถานะการรับ-ส่งสินค้าที่โปร่งใส</span>
                  </li>
                </ul>
                <Link href="/register" className="block pt-2">
                  <Button variant="outline" size="sm" className="w-full">
                    สมัครเป็นไรเดอร์
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

    </div>
  );
}
