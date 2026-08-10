import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Chestone Properties | Structured Property Solutions in Nairobi",
  description:
    "Chestone Properties Ltd — curated homes and apartments in Kilimani, Kileleshwa, Westlands, Lavington, Karen, and Riverside Drive, Nairobi.",
  keywords: [
    "Chestone Properties",
    "Nairobi real estate",
    "Kilimani apartments",
    "Kileleshwa property",
    "Westlands apartments",
    "Lavington houses",
    "Karen villas",
    "Riverside Drive property",
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${playfair.variable} ${inter.variable} antialiased flex min-h-screen flex-col`} suppressHydrationWarning>
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <WhatsAppWidget />
      </body>
    </html>
  );
}
