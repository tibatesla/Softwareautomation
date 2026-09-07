import Image from "next/image";
import Link from "next/link";
import { getProperties } from "@/lib/api";
import { PropertyCard } from "@/components/property-card";
import { FOCUS_AREAS } from "@/lib/types";

const AREA_TAGLINES: Record<string, string> = {
  Kilimani: "High-rise apartment living in Nairobi's business district",
  Kileleshwa: "Quiet, leafy family neighborhoods close to the city",
  Westlands: "Modern residences steps from Nairobi's commercial hub",
  Lavington: "Established, tree-lined streets and executive homes",
  Karen: "Spacious villas and estates on Nairobi's green outskirts",
  Riverside: "Premium riverfront apartments near the diplomatic district",
  Runda: "Gated luxury estates amid Nairobi's forested northern suburbs",
};

export default async function HomePage() {
  const properties = await getProperties().catch(() => []);
  const featured = properties.slice(0, 6);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-onyx text-ivory">
        <div className="pointer-events-none absolute -right-24 -top-24 size-[28rem] rounded-full bg-gold/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-[26rem] rounded-full bg-gold/12 blur-3xl" />
        <div className="pointer-events-none absolute left-1/2 top-1/3 size-[24rem] -translate-x-1/2 rounded-full bg-gold-light/8 blur-3xl" />

        <div className="container-page relative flex flex-col items-center gap-8 py-20 text-center md:py-36">
          <Image src="/logo-mark.jpg" alt="Chestone Properties" width={72} height={72} className="rounded-lg" priority />
          <h1 className="max-w-3xl font-serif text-4xl font-semibold leading-tight text-balance md:text-6xl">
            Structured Property Solutions in{" "}
            <span className="text-gold">Nairobi&apos;s</span> Finest Neighborhoods
          </h1>
          <p className="max-w-xl text-base text-stone md:text-lg">
            Curated homes and apartments in Kilimani, Kileleshwa, Westlands, Lavington, Karen,
            Riverside Drive, and Runda — every listing verified, every enquiry handled by a dedicated consultant.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/properties"
              className="btn-gold rounded-full px-8 py-3.5 text-sm font-semibold uppercase tracking-wider text-ivory"
            >
              Browse Properties
            </Link>
            <Link
              href="/#contact"
              className="rounded-full border border-white/50 bg-white/30 px-8 py-3.5 backdrop-blur-md text-sm font-semibold uppercase tracking-wider text-ivory transition-all hover:border-gold hover:text-gold hover:shadow-[0_0_24px_-6px_rgba(184,134,63,0.45)]"
            >
              Get in Touch
            </Link>
          </div>
        </div>
      </section>

      {/* Areas we serve */}
      <section id="areas" className="container-page py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Where We Operate</span>
          <h2 className="mt-3 font-serif text-3xl font-semibold text-ivory md:text-4xl">Areas We Serve</h2>
          <div className="gold-rule mx-auto mt-4" />
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FOCUS_AREAS.map((area) => (
            <Link
              key={area}
              href={`/properties?area=${encodeURIComponent(area)}`}
              className="card-shine group relative flex flex-col justify-end overflow-hidden rounded-3xl border border-white/50 p-8 text-ivory transition-all hover:-translate-y-1 hover:border-gold/40"
              style={{ minHeight: "180px" }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-gold/10 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative">
                <h3 className="font-serif text-2xl font-semibold">{area}</h3>
                <p className="mt-1 text-sm text-stone">{AREA_TAGLINES[area]}</p>
                <span className="mt-3 inline-block text-xs font-semibold uppercase tracking-wider text-gold opacity-0 transition-opacity group-hover:opacity-100">
                  View Listings →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured properties */}
      {featured.length > 0 && (
        <section className="bg-onyx-light py-24">
          <div className="container-page">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Handpicked</span>
                <h2 className="mt-3 font-serif text-3xl font-semibold text-ivory md:text-4xl">Featured Listings</h2>
              </div>
              <Link href="/properties" className="text-sm font-semibold text-gold underline-offset-4 hover:underline">
                View all properties →
              </Link>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Value proposition */}
      <section className="container-page py-24">
        <div className="grid gap-12 md:grid-cols-3">
          {[
            {
              title: "Verified Listings",
              body: "Every property is reviewed and managed directly by our team — no stale listings, no surprises.",
            },
            {
              title: "Dedicated Consultants",
              body: "Every enquiry is handled by a Chestone consultant who knows the property and the process.",
            },
            {
              title: "Transparent Pricing",
              body: "Clear pricing and payment plan structures upfront, so you always know exactly what you're working with.",
            },
          ].map((item) => (
            <div key={item.title}>
              <div className="gold-rule" />
              <h3 className="mt-4 font-serif text-xl font-semibold text-ivory">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
