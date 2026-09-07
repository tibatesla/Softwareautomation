import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProperties } from "@/lib/api";
import { PublicProperty } from "@/lib/types";
import { whatsappEnquiryLink } from "@/lib/format";
import { PropertyGallery } from "@/components/property-gallery";
import { PropertyCard } from "@/components/property-card";
import { AmenitiesList } from "@/components/amenities-list";
import { PriceRangeDisplay } from "@/components/price-display";

type Params = Promise<{ name: string }>;

async function loadDevelopment(name: string) {
  const developmentName = decodeURIComponent(name);
  const units = await getProperties({ development: developmentName }).catch(() => []);
  return { developmentName, units };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { name } = await params;
  const { developmentName, units } = await loadDevelopment(name);
  if (units.length === 0) return {};
  return {
    title: `${developmentName} | Chestone Properties Ltd`,
    description: `${units.length} unit type${units.length === 1 ? "" : "s"} available at ${developmentName}. Browse pricing, sizes and amenities.`,
  };
}

// location/subLocation frequently overlap in the CRM data (e.g. location
// "Westlands, Nairobi", subLocation "Westlands") -- this avoids repeating
// the same word twice in the page heading.
function combineLocation(loc: string | null, sub: string | null): string | null {
  const a = loc?.trim() || null;
  const b = sub?.trim() || null;
  if (!a) return b;
  if (!b) return a;
  if (a.toLowerCase().includes(b.toLowerCase())) return a;
  if (b.toLowerCase().includes(a.toLowerCase())) return b;
  return `${b}, ${a}`;
}

function priceOf(u: PublicProperty): number {
  return Number(u.priceMin || u.price) || Number.MAX_SAFE_INTEGER;
}

export default async function DevelopmentPage({ params }: { params: Params }) {
  const { name } = await params;
  const { developmentName, units } = await loadDevelopment(name);

  if (units.length === 0) {
    notFound();
  }

  const first = units[0];
  const location = combineLocation(first.location, first.subLocation);
  const sortedUnits = [...units].sort((a, b) => priceOf(a) - priceOf(b));

  const priceValues = units
    .flatMap((u) => [Number(u.priceMin || u.price), Number(u.priceMax || u.price)])
    .filter((n) => n > 0);
  const minPrice = priceValues.length > 0 ? Math.min(...priceValues) : null;
  const maxPrice = priceValues.length > 0 ? Math.max(...priceValues) : null;

  const allImages = [...new Set(units.flatMap((u) => u.images))];
  const allAmenities = [...new Set(units.flatMap((u) => u.amenities))];
  const allOutstandingAmenities = [...new Set(units.flatMap((u) => u.outstandingAmenities))];

  return (
    <div className="container-page py-12 md:py-16">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-2 text-xs text-stone">
        <Link href="/" className="hover:text-gold">
          Home
        </Link>
        <span>/</span>
        <Link href="/properties" className="hover:text-gold">
          Properties
        </Link>
        <span>/</span>
        <span className="text-ivory">{developmentName}</span>
      </nav>

      <div className="mt-4">
        {location && <span className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">{location}</span>}
        <h1 className="mt-2 font-serif text-2xl font-semibold text-ivory md:text-4xl">{developmentName}</h1>
        <p className="mt-2 text-sm text-stone">
          {units.length} unit type{units.length === 1 ? "" : "s"} available
        </p>
      </div>

      {allImages.length > 0 ? (
        <PropertyGallery images={allImages} title={developmentName} />
      ) : (
        <div className="card-shine mt-8 flex aspect-video items-center justify-center rounded-3xl border border-white/50 text-sm text-stone">
          Photos coming soon
        </div>
      )}

      <div className="mt-12 grid gap-12 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2">
          <span className="font-serif text-2xl font-semibold text-ivory md:text-3xl">
            <PriceRangeDisplay
              min={minPrice !== null ? String(minPrice) : null}
              max={maxPrice !== null && maxPrice !== minPrice ? String(maxPrice) : null}
              single="0"
              currency={first.currency}
            />
          </span>

          <div className="gold-rule mt-8" />
          <h2 className="mt-4 font-serif text-xl font-semibold text-ivory">Unit Types &amp; Prices</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {sortedUnits.map((unit) => (
              <PropertyCard key={unit.id} property={unit} />
            ))}
          </div>

          {allAmenities.length > 0 && (
            <>
              <div className="gold-rule mt-8" />
              <h2 className="mt-4 font-serif text-xl font-semibold text-ivory">Amenities &amp; Lifestyle</h2>
              <div className="mt-4">
                <AmenitiesList amenities={allAmenities} outstanding={allOutstandingAmenities} />
              </div>
            </>
          )}
        </div>

        {/* Enquiry card */}
        <div>
          <div className="card-shine sticky top-28 rounded-3xl border border-white/50 p-8">
            <h3 className="font-serif text-xl font-semibold text-ivory">Interested in {developmentName}?</h3>
            <p className="mt-2 text-sm text-stone">
              Message a Chestone consultant directly on WhatsApp — we&apos;ll walk you through unit availability and
              pricing.
            </p>
            <a
              href={whatsappEnquiryLink(developmentName)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold mt-6 flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold uppercase tracking-wider text-ivory"
            >
              Enquire on WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
