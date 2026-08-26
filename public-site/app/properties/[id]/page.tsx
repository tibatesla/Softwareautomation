import Link from "next/link";
import { notFound } from "next/navigation";
import { getProperty } from "@/lib/api";
import { formatPrice, formatPriceRange, formatSizeRange, whatsappEnquiryLink } from "@/lib/format";
import { PropertyGallery } from "@/components/property-gallery";

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const property = await getProperty(id).catch(() => null);

  if (!property) {
    notFound();
  }

  const priceLabel =
    formatPriceRange(property.priceMin, property.priceMax, property.currency) ??
    formatPrice(property.price, property.currency);

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
          <h1 className="mt-2 font-serif text-3xl font-semibold text-ivory md:text-4xl">{property.title}</h1>
        </div>
        {property.status === "reserved" && (
          <span className="rounded-sm bg-onyx-light px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-ivory ring-1 ring-white/10">
            Reserved
          </span>
        )}
      </div>

      {/* Image gallery: swipeable slider on mobile, clickable grid on desktop -- both open a full-screen browsable viewer */}
      {property.images.length > 0 ? (
        <PropertyGallery images={property.images} title={property.title} />
      ) : (
        <div className="mt-8 flex aspect-video items-center justify-center rounded-md bg-onyx-light text-sm text-stone">
          Photos coming soon
        </div>
      )}

      <div className="mt-12 grid gap-12 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2">
          <div className="flex items-baseline gap-3">
            <span className="font-serif text-3xl font-semibold text-ivory">{priceLabel}</span>
            {property.paymentPlanStructure && (
              <span className="text-sm text-stone">· {property.paymentPlanStructure}</span>
            )}
          </div>

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
              <div className="mt-4 flex flex-wrap gap-2">
                {property.amenities.map((amenity) => (
                  <span
                    key={amenity}
                    className="rounded-full bg-onyx-light px-3.5 py-1.5 text-xs font-medium text-ivory ring-1 ring-white/10"
                  >
                    {amenity}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Enquiry card */}
        <div>
          <div className="sticky top-28 rounded-md border border-white/10 bg-onyx-light p-8">
            <h3 className="font-serif text-xl font-semibold text-ivory">Interested in this property?</h3>
            <p className="mt-2 text-sm text-stone">
              Message a Chestone consultant directly on WhatsApp — we&apos;ll confirm availability and set up a
              viewing.
            </p>
            <a
              href={whatsappEnquiryLink(property.title)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 flex items-center justify-center gap-2 rounded-sm bg-gold px-6 py-3.5 text-sm font-semibold uppercase tracking-wider text-onyx transition-colors hover:bg-gold-light"
            >
              Enquire on WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
