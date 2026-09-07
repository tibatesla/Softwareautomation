import Link from "next/link";
import { notFound } from "next/navigation";
import { getProperty } from "@/lib/api";
import { formatSizeRange, whatsappEnquiryLink } from "@/lib/format";
import { PropertyGallery } from "@/components/property-gallery";
import { AmenitiesList } from "@/components/amenities-list";
import { PriceRangeDisplay } from "@/components/price-display";

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const property = await getProperty(id).catch(() => null);

  if (!property) {
    notFound();
  }

  const facts = [
    { label: "Unit Type", value: property.unitType },
    { label: "Total Units", value: property.totalUnits },
    { label: "Floors", value: property.levelFloors },
    { label: "Size", value: formatSizeRange(property.houseSizeSqftMin, property.houseSizeSqftMax, property.houseSizeSqft) },
    { label: "View", value: property.view },
    { label: "Completion", value: property.completionTime },
    { label: "Reference", value: property.referenceId },
  ].filter((f) => f.value !== null && f.value !== undefined);

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
        {property.location && (
          <>
            <span>/</span>
            <Link href={`/properties?area=${encodeURIComponent(property.location)}`} className="hover:text-gold">
              {property.location}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-ivory">{property.title}</span>
      </nav>

      <div className="mt-4 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">
            {property.location}
            {property.subLocation ? ` — ${property.subLocation}` : ""}
          </span>
          <h1 className="mt-2 font-serif text-xl font-semibold text-ivory md:text-3xl">{property.title}</h1>
          {property.developmentName && (
            <Link
              href={`/developments/${encodeURIComponent(property.developmentName)}`}
              className="mt-2 inline-block text-xs font-medium text-stone underline-offset-4 hover:text-gold hover:underline"
            >
              Part of {property.developmentName} — view all unit types
            </Link>
          )}
        </div>
        {property.status === "reserved" && (
          <span className="rounded-full bg-onyx-light px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-ivory ring-1 ring-black/10">
            Reserved
          </span>
        )}
      </div>

      {/* Image gallery: swipeable slider on mobile, clickable grid on desktop -- both open a full-screen browsable viewer */}
      {property.images.length > 0 ? (
        <PropertyGallery images={property.images} title={property.title} />
      ) : (
        <div className="card-shine mt-8 flex aspect-video items-center justify-center rounded-3xl border border-white/50 text-sm text-stone">
          Photos coming soon
        </div>
      )}

      <div className="mt-12 grid gap-12 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2">
          <span className="block font-serif text-2xl font-semibold text-ivory md:text-3xl">
            <PriceRangeDisplay
              min={property.priceMin}
              max={property.priceMax}
              single={property.price}
              currency={property.currency}
            />
          </span>
          {property.paymentPlanStructure && (
            <p className="mt-2 text-sm text-stone">{property.paymentPlanStructure}</p>
          )}

          {property.description && (
            <>
              <div className="gold-rule mt-8" />
              <h2 className="mt-4 font-serif text-xl font-semibold text-ivory">About This Property</h2>
              <p className="mt-3 text-sm leading-relaxed text-stone">{property.description}</p>
            </>
          )}

          {facts.length > 0 && (
            <>
              <div className="gold-rule mt-8" />
              <h2 className="mt-4 font-serif text-xl font-semibold text-ivory">Details</h2>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                {facts.map((fact) => (
                  <div key={fact.label}>
                    <dt className="text-xs uppercase tracking-wider text-stone">{fact.label}</dt>
                    <dd className="mt-1 text-sm font-medium text-ivory">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}

          {property.amenities.length > 0 && (
            <>
              <div className="gold-rule mt-8" />
              <h2 className="mt-4 font-serif text-xl font-semibold text-ivory">Amenities</h2>
              <div className="mt-4">
                <AmenitiesList amenities={property.amenities} outstanding={property.outstandingAmenities} />
              </div>
            </>
          )}
        </div>

        {/* Enquiry card */}
        <div>
          <div className="card-shine sticky top-28 rounded-3xl border border-white/50 p-8">
            <h3 className="font-serif text-xl font-semibold text-ivory">Interested in this property?</h3>
            <p className="mt-2 text-sm text-stone">
              Message a Chestone consultant directly on WhatsApp — we&apos;ll confirm availability and set up a
              viewing.
            </p>
            <a
              href={whatsappEnquiryLink(property.title)}
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
