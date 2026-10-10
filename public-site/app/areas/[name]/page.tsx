import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProperties } from "@/lib/api";
import { FOCUS_AREAS, type FocusArea } from "@/lib/types";
import { PropertyCard } from "@/components/property-card";
import { availableTypes } from "@/lib/landing-pages";

type Params = Promise<{ name: string }>;

// Client-approved copy -- gives each area page genuine, unique content
// (not just a filtered property list) so it can stand on its own for
// search rather than reading as a duplicate of /properties?area=X.
const AREA_COPY: Record<FocusArea, string> = {
  Kilimani:
    "Kilimani is Nairobi's most energetic residential address for young professionals — a dense cluster of modern high-rise apartments minutes from Yaya Centre, Nairobi Hospital, and the city's best restaurants and nightlife. Its walkability and constant redevelopment make it one of the strongest rental markets in the city.",
  Kileleshwa:
    "Kileleshwa offers a quieter, more established alternative to neighbouring Kilimani — tree-lined streets, mid-rise apartment blocks, and a long-standing mix of local and expatriate residents. It sits within easy reach of Westlands and the CBD while retaining a settled, residential character.",
  Westlands:
    "Westlands is Nairobi's second business district in all but name, anchoring corporate offices, malls like Sarit Centre and The Mall, and a fast-growing skyline of premium apartments. It suits professionals who want to live close to work, dining, and entertainment without sacrificing modern finishes.",
  Lavington:
    "Lavington is one of Nairobi's most established upscale suburbs — spacious family homes and gated apartment compounds set along quiet, leafy streets, close to some of the city's top schools. It appeals to families and professionals looking for more room and a settled, low-density feel.",
  Karen:
    "Karen is Nairobi's premier low-density suburb, known for expansive plots, colonial-era character, and forested surroundings near the Karen Blixen Museum and Ngong Road Forest. It remains the address of choice for families and executives wanting privacy, space, and greenery within the city.",
  Riverside:
    "Riverside Drive is one of Nairobi's most prestigious corridors — home to embassies, diplomatic residences, and a growing number of premium high-rise developments set among mature greenery along the Nairobi River, yet just minutes from Westlands and the CBD.",
  Runda:
    "Runda is Nairobi's benchmark gated-estate community — large luxury homes, round-the-clock security, and generous grounds, favoured by diplomats and senior executives. Its proximity to top international schools makes it a consistent first choice for relocating families.",
};

// Added: gives buyers concrete fit/diligence signals and gives search
// engines a real Place + geo block to attach to each area, beyond the
// existing BreadcrumbList schema.
const AREA_DETAIL: Record<FocusArea, { fitFor: string[]; diligence: string[]; lat: number; lng: number }> = {
  Kilimani: {
    fitFor: ["Professionals and corporate renters", "Smaller households", "Investors seeking furnished, rentable stock"],
    diligence: ["Building quality and management", "Service charge history", "Water and parking allocation", "Adjacent construction exposure"],
    lat: -1.2921,
    lng: 36.7833,
  },
  Kileleshwa: {
    fitFor: ["Families", "Executive renters and owner-occupiers", "Buyers wanting more space near the city"],
    diligence: ["Road and drainage condition", "Sewerage capacity", "Lift and generator maintenance", "Parking allocation"],
    lat: -1.2793,
    lng: 36.7833,
  },
  Westlands: {
    fitFor: ["Corporate tenants and professionals", "Investors comparing serviced vs. long-term stock", "Buyers prioritising business-district access"],
    diligence: ["Serviced vs. long-term management distinction", "Service charge and supply pipeline", "Parking availability", "Achieved (not just asking) rent"],
    lat: -1.2648,
    lng: 36.8039,
  },
  Lavington: {
    fitFor: ["Executives and families", "Furnished-tenant demand", "Townhouse and villa buyers"],
    diligence: ["Apartment vs. home distinction", "Service charge and utilities", "Building age", "School and workplace commute times"],
    lat: -1.2769,
    lng: 36.7719,
  },
  Karen: {
    fitFor: ["School-led families", "Privacy-seeking owner-occupiers", "Furnished-compound and lifestyle buyers"],
    diligence: ["Plot and internal area", "Staff quarters and maintenance", "School route", "Water, security, and drainage exposure"],
    lat: -1.3192,
    lng: 36.7076,
  },
  Riverside: {
    fitFor: ["Diplomats and international-organisation staff", "Senior executives", "Prestige owner-occupiers"],
    diligence: ["Title and utilities", "Flood and drainage exposure", "Traffic and access control", "Parking"],
    lat: -1.2687,
    lng: 36.8098,
  },
  Runda: {
    fitFor: ["Families wanting larger plots", "Privacy-focused owner-occupiers", "Buyers comparing Karen vs. Runda for space and access trade-offs"],
    diligence: ["Plot size and boundaries", "Estate management and service charge", "Security arrangements", "Access road condition"],
    lat: -1.2172,
    lng: 36.8267,
  },
};


export async function generateStaticParams() {
  return FOCUS_AREAS.map((name) => ({ name }));
}

function matchArea(name: string): FocusArea | undefined {
  const decoded = decodeURIComponent(name);
  return FOCUS_AREAS.find((a) => a.toLowerCase() === decoded.toLowerCase());
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { name } = await params;
  const area = matchArea(name);
  if (!area) return {};

  const title = `Apartments & Homes for Sale in ${area}, Nairobi | Chestone Properties`;
  const description = AREA_COPY[area].slice(0, 155);
  const properties = await getProperties({ area }).catch(() => []);
  const image = properties.find((p) => p.images.length > 0)?.images[0];

  return {
    title,
    description,
    alternates: { canonical: `/areas/${area}` },
    ...(properties.length === 0 ? { robots: { index: false } } : {}),
    openGraph: {
      title,
      description,
      type: "website",
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function AreaPage({ params }: { params: Params }) {
  const { name } = await params;
  const area = matchArea(name);
  if (!area) notFound();

  const properties = await getProperties({ area }).catch(() => []);
  const otherAreas = FOCUS_AREAS.filter((a) => a !== area);
  const detail = AREA_DETAIL[area];
  const typeLinks = availableTypes(properties);

  const pricedProperties = properties
    .map((p) => Number(p.priceMin) || Number(p.price) || 0)
    .filter((p) => p > 0);
  const priceRangeText =
    pricedProperties.length > 0
      ? `${new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(Math.min(...pricedProperties))} to ${new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(Math.max(...pricedProperties))}`
      : null;

  const areaFaqs = [
    ...(priceRangeText
      ? [
          {
            question: `What is the price range for properties in ${area}?`,
            answer: `Current ${area} listings with Chestone range from ${priceRangeText}, depending on size, unit type, and finish. See live pricing on each listing below.`,
          },
        ]
      : []),
    {
      question: `Is ${area} good for diaspora investment?`,
      answer: `Yes. ${area} is one of our focus corridors, and diaspora buyers regularly purchase remotely — your consultant handles viewings by video call, reservation, and paperwork over WhatsApp, so you don't need to be in Nairobi to buy here.`,
    },
  ];

  const areaFaqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: areaFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
  const canonicalUrl = `https://www.chestoneproperties.com/areas/${encodeURIComponent(area)}`;
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://www.chestoneproperties.com" },
      { "@type": "ListItem", position: 2, name: "Properties", item: "https://www.chestoneproperties.com/properties" },
      { "@type": "ListItem", position: 3, name: area, item: canonicalUrl },
    ],
  };

  // Added: place-level schema with real geo coordinates -- this area page
  // previously had no geo/Place data at all.
  const placeJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Properties in ${area}, Nairobi`,
    description: AREA_COPY[area].slice(0, 155),
    url: canonicalUrl,
    about: {
      "@type": "Place",
      name: `${area}, Nairobi`,
      geo: {
        "@type": "GeoCoordinates",
        latitude: detail.lat,
        longitude: detail.lng,
      },
    },
  };

  return (
    <div className="container-page py-16 md:py-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(placeJsonLd) }} />
       <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(areaFaqJsonLd) }} />
  <nav className="flex flex-wrap items-center gap-2 text-xs text-stone">
        <Link href="/" className="hover:text-gold">
          Home
        </Link>
        <span>/</span>
        <Link href="/properties" className="hover:text-gold">
          Properties
        </Link>
        <span>/</span>
        <span className="text-ivory">{area}</span>
      </nav>

      <div className="mt-4 max-w-2xl">
        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Nairobi Neighbourhood</span>
        <h1 className="mt-3 font-serif text-4xl font-semibold text-ivory">Apartments &amp; Homes for Sale in {area}, Nairobi</h1>
        <p className="mt-4 text-sm leading-relaxed text-stone">{AREA_COPY[area]}</p>
      </div>

      {/* Added: who-fits / what-to-check, matching the diligence framing
          used across the market report and the rest of the site's content. */}
      <section className="mt-8 grid gap-8 sm:grid-cols-2 max-w-3xl">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gold">Who this area fits</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-stone">
            {detail.fitFor.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gold">What to check before you buy</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-stone">
            {detail.diligence.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          href={`/properties?area=${encodeURIComponent(area)}`}
          className="btn-gold rounded-full px-6 py-2.5 text-sm font-semibold uppercase tracking-wider text-ivory"
        >
          Filter &amp; sort {area} listings
        </Link>
        <span className="text-sm text-stone">
          {properties.length} {properties.length === 1 ? "property" : "properties"} available
        </span>
      </div>

      {typeLinks.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-2">
          {typeLinks.map((t) => (
            <Link
              key={t.slug}
              href={`/areas/${encodeURIComponent(area)}/${t.slug}`}
              className="rounded-full bg-onyx-light px-4 py-2 text-sm font-medium text-stone ring-1 ring-black/10 transition-colors hover:ring-gold/40"
            >
              {t.label}
            </Link>
          ))}
        </div>
      )}

      {properties.length > 0 ? (
        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((property, index) => (
            <PropertyCard key={property.id} property={property} priority={index < 3} />
          ))}
        </div>
      ) : (
        <div className="card-shine mt-12 rounded-3xl border border-white/50 px-8 py-14 text-center">
          <p className="font-serif text-xl text-ivory">No {area} listings just yet</p>
          <p className="mt-2 text-sm text-stone">Check back soon, or browse all current properties.</p>
        </div>
      )}

      <div className="mt-16 border-t border-black/10 pt-8">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Other Areas We Serve</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {otherAreas.map((a) => (
            <Link
              key={a}
              href={`/areas/${encodeURIComponent(a)}`}
              className="rounded-full bg-onyx-light px-4 py-2 text-sm font-medium text-stone ring-1 ring-black/10 transition-colors hover:ring-gold/40"
            >
              {a}
            </Link>
          ))}
        </div>
      </div>
      <div className="mt-16 border-t border-black/10 pt-8">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          {area} — Frequently Asked Questions
        </h2>
        <div className="mt-4 flex flex-col gap-3">
          {areaFaqs.map((faq) => (
            <details
              key={faq.question}
              className="card-shine group rounded-3xl border border-white/50 px-6 py-1 open:pb-5"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-serif text-lg font-semibold text-ivory marker:content-none">
                {faq.question}
                <span className="shrink-0 text-xl font-normal text-gold transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="text-sm leading-relaxed text-stone">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
