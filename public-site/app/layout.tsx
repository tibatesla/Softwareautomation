import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { CurrencyProvider } from "@/components/currency-provider";
import { fetchKesPerUsd } from "@/lib/currency";

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
  // Lets every page below use a relative `alternates.canonical` path --
  // Next resolves it against this base instead of each page needing the
  // full https://www.chestoneproperties.com/... URL hardcoded. www is the
  // real served domain (the bare domain 301s to it), so canonical tags and
  // the sitemap need to point here directly rather than through that
  // redirect hop.
  metadataBase: new URL("https://www.chestoneproperties.com"),
  alternates: { canonical: "/" },
  title: "Apartments for Sale in Nairobi | Chestone Properties",
  description:
    "Chestone Properties Ltd — curated homes and apartments in Karen, Lavington, Runda, Westlands, Kilimani, Kileleshwa, and Riverside Drive, Nairobi.",
  keywords: [
    "Chestone Properties",
    "Nairobi real estate",
    "Kilimani apartments",
    "Kileleshwa property",
    "Westlands apartments",
    "Lavington houses",
    "Karen villas",
    "Riverside Drive property",
    "Runda estates",
  ],
  // Sitewide fallback -- pages with a specific photo (a property, a
  // development, an area with listings) override this in their own
  // metadata; everything else (homepage, FAQ, privacy policy) falls back
  // to the logo so a shared link is never blank. logo-full.png is 1023x791,
  // not the ideal 1200x630 OG ratio -- fine as a fallback, but a
  // purpose-made 1200x630 banner would render better once one exists.
  openGraph: {
    type: "website",
    siteName: "Chestone Properties",
    locale: "en_KE",
    title: "Apartments for Sale in Nairobi | Chestone Properties",
    description:
      "Chestone Properties Ltd — curated homes and apartments in Karen, Lavington, Runda, Westlands, Kilimani, Kileleshwa, and Riverside Drive, Nairobi.",
    images: [{ url: "/logo-full.png", width: 1023, height: 791, alt: "Chestone Properties" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Apartments for Sale in Nairobi | Chestone Properties",
    description:
      "Chestone Properties Ltd — curated homes and apartments in Karen, Lavington, Runda, Westlands, Kilimani, Kileleshwa, and Riverside Drive, Nairobi.",
    images: ["/logo-full.png"],
  },
};

// Sitewide Organization schema -- lets Google associate search results and
// the knowledge panel with the business itself (name, logo, contact point),
// independent of whatever specific page someone lands on.
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "RealEstateAgent",
  name: "Chestone Properties Ltd",
  url: "https://www.chestoneproperties.com",
  logo: "https://www.chestoneproperties.com/logo-full.png",
  image: "https://www.chestoneproperties.com/logo-full.png",
  areaServed: ["Kilimani", "Kileleshwa", "Westlands", "Lavington", "Karen", "Riverside", "Runda", "Nairobi"],
  address: {
    "@type": "PostalAddress",
    streetAddress: "Marsabit Plaza, Ngong Road",
    addressLocality: "Nairobi",
    addressCountry: "KE",
  },
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+254726111133",
    contactType: "sales",
    areaServed: "KE",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const kesPerUsd = await fetchKesPerUsd();

  return (
    <html lang="en">
      <body className={`${playfair.variable} ${inter.variable} antialiased flex min-h-screen flex-col`} suppressHydrationWarning>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
        <CurrencyProvider kesPerUsd={kesPerUsd}>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
          <WhatsAppWidget />
        </CurrencyProvider>
      </body>
    </html>
  );
}
