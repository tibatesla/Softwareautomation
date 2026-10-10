import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProperties } from "@/lib/api";
import { propertyUrl } from "@/lib/slug";
import { PropertyCard } from "@/components/property-card";
import {
  availableTypes,
  filterByType,
  formatMillions,
  getLandingType,
  joinList,
  matchLandingArea,
  MIN_LISTINGS,
} from "@/lib/landing-pages";

type Params = Promise<{ name: string; type: string }>;
const SITE = "https://www.chestoneproperties.com";

async function load(name: string, type: string) {
  const area = matchLandingArea(name);
  const landing = getLandingType(type);
  if (!area || !landing) return null;
  const all = await getProperties({ area }).catch(() => []);
  const listings = filterByType(all, landing);
  if (!availableTypes(all).some((t) => t.slug === landing.slug)) return null;
  const starts = listings.map((p) => Number(p.priceMin) || Number(p.price) || 0).filter((n) => n > 0);
  const from = starts.length ? Math.min(...starts) : null;
  const roads = Array.from(
    new Set(
      listings
        .map((p) => (p.subLocation ?? "").replace(new RegExp(`,?\\s*${area}$`, "i"), "").trim())
        .filter(Boolean),
    ),
  ).slice(0, 6);
  return { area, landing, all, listings, from, roads };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { name, type } = await params;
  const data = await load(name, type);
  if (!data) return { robots: { index: false } };
  const { area, landing, listings, from } = data;
  const title = `${landing.label} for Sale in ${area}, Nairobi | Chestone Properties`;
  const description = `Buy ${landing.label.toLowerCase()} in ${area}, Nairobi: ${listings.length} listings${from ? ` from ${formatMillions(from)}` : ""}. Verified availability and direct WhatsApp advisory.`;
  const image = listings.find((p) => p.images.length > 0)?.images[0];
  const canonical = `/areas/${area}/${landing.slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, type: "website", url: canonical, ...(image ? { images: [{ url: image }] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
  };
}

export default async function LandingPage({ params }: { params: Params }) {
  const { name, type } = await params;
  const data = await load(name, type);
  if (!data) notFound();
  const { area, landing, all, listings, from, roads } = data;

  const lower = landing.label.toLowerCase();
  const siblings = availableTypes(all).filter((t) => t.slug !== landing.slug);
  const url = `${SITE}/areas/${area}/${landing.slug}`;

  const faqs = [
    ...(from
      ? [{
          question: `How much do ${lower} cost in ${area}?`,
          answer: `${landing.label} listed with Chestone in ${area} start from ${formatMillions(from)}. Final pricing depends on unit size, floor and finish; see each listing for its range.`,
        }]
      : []),
    ...(roads.length
      ? [{
          question: `Where are the ${lower} in ${area}?`,
          answer: `Current listings are on ${joinList(roads)} in ${area}, Nairobi.`,
        }]
      : []),
    {
      question: `How do I buy ${lower} in ${area}?`,
      answer: `Choose a listing, message your Chestone consultant on WhatsApp, and arrange a viewing in person or by video call. Reservation and paperwork are handled over WhatsApp.`,
    },
    {
      question: `Can I buy ${lower} in ${area} from abroad?`,
      answer: `Yes. Diaspora buyers regularly purchase remotely; your consultant handles viewings by video call, reservation, and paperwork over WhatsApp.`,
    },
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE },
        { "@type": "ListItem", position: 2, name: "Properties", item: `${SITE}/properties` },
        { "@type": "ListItem", position: 3, name: area, item: `${SITE}/areas/${area}` },
        { "@type": "ListItem", position: 4, name: landing.label, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${landing.label} for Sale in ${area}, Nairobi`,
      url,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: listings.length,
        itemListElement: listings.slice(0, 20).map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${SITE}${propertyUrl(p)}`,
          name: p.title,
        })),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    },
  ];

  const pill =
    "rounded-full bg-onyx-light px-4 py-2 text-sm font-medium text-stone ring-1 ring-black/10 transition-colors hover:ring-gold/40";

  return (
    <div className="container-page py-16 md:py-20">
      {jsonLd.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d) }} />
      ))}

      <nav className="flex flex-wrap items-center gap-2 text-xs text-stone">
        <Link href="/" className="hover:text-gold">Home</Link>
        <span>/</span>
        <Link href="/properties" className="hover:text-gold">Properties</Link>
        <span>/</span>
        <Link href={`/areas/${area}`} className="hover:text-gold">{area}</Link>
        <span>/</span>
        <span className="text-ivory">{landing.label}</span>
      </nav>

      <div className="mt-4 max-w-2xl">
        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">{area}, Nairobi</span>
        <h1 className="mt-3 font-serif text-4xl font-semibold text-ivory">
          {landing.label} for Sale in {area}, Nairobi
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-stone">
          Chestone currently lists {listings.length} {lower} for sale in {area}
          {from ? `, with prices starting from ${formatMillions(from)}` : ""}.
          {roads.length ? ` Listings are on ${joinList(roads)}.` : ""}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-stone">{landing.blurb}</p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((property, index) => (
          <PropertyCard key={property.id} property={property} priority={index < 3} />
        ))}
      </div>

      {siblings.length > 0 && (
        <div className="mt-16 border-t border-black/10 pt-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">More in {area}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/areas/${area}`} className={pill}>All {area} listings</Link>
            {siblings.map((t) => (
              <Link key={t.slug} href={`/areas/${area}/${t.slug}`} className={pill}>{t.label}</Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-16 border-t border-black/10 pt-8">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Frequently Asked Questions</h2>
        <div className="mt-4 flex flex-col gap-3">
          {faqs.map((faq) => (
            <details key={faq.question} className="card-shine group rounded-3xl border border-white/50 px-6 py-1 open:pb-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-serif text-lg font-semibold text-ivory marker:content-none">
                {faq.question}
                <span className="shrink-0 text-xl font-normal text-gold transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="text-sm leading-relaxed text-stone">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
