import Link from "next/link";
import { notFound } from "next/navigation";
import { getProperty } from "@/lib/api";
import { formatPrice, formatPriceRange, whatsappEnquiryLink } from "@/lib/format";
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
    { label: "Size", value: property.houseSizeSqft ? `${Number(property.houseSizeSqft).toLocaleString()} sqft` : null },
    { label: "View", value: property.view },
    { label: "Completion", value: property.completionTime },
    { label: "Reference", value: property.referenceId },
  ].filter((f) => f.value !== null && f.value !== undefined);

  return (
    <div className="container-page py-12 md:py-16">
      <Link href="/properties" className="text-sm font-medium text-stone hover:text-navy">
        ← Back to all properties
      </Link>

      <div className="mt-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">
            {property.location}
            {property.subLocation ? ` — ${property.subLocation}` : ""}
          </span>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-navy md:text-4xl">{property.title}</h1>
        </div>
        {property.status === "reserved" && (
          <span className="rounded-sm bg-navy px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white">
            Reserved
          </span>
        )}
      </div>

      {/* Image gallery: swipeable slider on mobile, clickable grid on desktop -- both open a full-screen browsable viewer */}
      {property.images.length > 0 ? (
        <PropertyGallery images={property.images} title={property.title} />
      ) : (
        <div className="mt-8 flex aspect-video items-center justify-center rounded-md bg-stone/10 text-sm text-stone">
          Photos coming soon
        </div>
      )}

      <div className="mt-12 grid gap-12 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2">
          <div className="flex items-baseline gap-3">
            <span className="font-serif text-3xl font-semibold text-navy">{priceLabel}</span>
            {property.paymentPlanStructure && (
              <span className="text-sm text-stone">· {property.paymentPlanStructure}</span>
            )}
          </div>

          {property.description && (
            <>
              <div className="gold-rule mt-8" />
              <h2 className="mt-4 font-serif text-xl font-semibold text-navy">About This Property</h2>
              <p className="mt-3 text-sm leading-relaxed text-ink/80">{property.description}</p>
            </>
          )}

          {facts.length > 0 && (
            <>
              <div className="gold-rule mt-8" />
              <h2 className="mt-4 font-serif text-xl font-semibold text-navy">Details</h2>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                {facts.map((fact) => (
                  <div key={fact.label}>
                    <dt className="text-xs uppercase tracking-wider text-stone">{fact.label}</dt>
                    <dd className="mt-1 text-sm font-medium text-ink">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}

          {property.amenities.length > 0 && (
            <>
              <div className="gold-rule mt-8" />
              <h2 className="mt-4 font-serif text-xl font-semibold text-navy">Amenities</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {property.amenities.map((amenity) => (
                  <span
                    key={amenity}
                    className="rounded-full bg-navy/5 px-3.5 py-1.5 text-xs font-medium text-navy"
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
          <div className="sticky top-28 rounded-md bg-navy p-8 text-white">
            <h3 className="font-serif text-xl font-semibold">Interested in this property?</h3>
            <p className="mt-2 text-sm text-white/70">
              Message a Chestone consultant directly on WhatsApp — we&apos;ll confirm availability and set up a
              viewing.
            </p>
            <a
              href={whatsappEnquiryLink(property.title)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 flex items-center justify-center gap-2 rounded-sm bg-gold px-6 py-3.5 text-sm font-semibold uppercase tracking-wider text-navy-dark transition-colors hover:bg-gold-light"
            >
              Enquire on WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
