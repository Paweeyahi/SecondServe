import type { Metadata, Viewport } from "next";
import { Poppins, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/shared/Navbar";
import { CartProvider } from "@/context/CartContext";
import { SiteFooter } from "@/components/shared/SiteFooter";

// Brand typography (brand concept doc §11): Poppins for Latin text, numbers
// and prices; Noto Sans Thai for Thai. Poppins has no Thai glyphs, so the
// browser falls through to Noto Sans Thai character by character.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-poppins",
});

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-noto-thai",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "SecondServe — More Than an Expiry Date",
  description:
    "แพลตฟอร์มส่งต่อสินค้าใกล้หมดอายุ ซื้อของดีราคาประหยัดจากร้านใกล้คุณ และรับอาหารส่งต่อจากชุมชน",
  openGraph: {
    type: "website",
    siteName: "SecondServe",
    locale: "th_TH",
    title: "SecondServe — คุณค่ามีมากกว่าวันหมดอายุ",
    description:
      "ซื้อสินค้าใกล้หมดอายุราคาประหยัด รับเองหรือให้ไรเดอร์ส่ง และรับอาหารส่งต่อจากชุมชนฟรี",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${poppins.variable} ${notoSansThai.variable}`}>
      <body className="min-h-screen flex flex-col bg-neutral-50 text-neutral-900 font-sans antialiased selection:bg-forest-100 selection:text-forest-900">
        <CartProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
        </CartProvider>
        <SiteFooter />
      </body>
    </html>
  );
}
