import Link from "next/link";
import { getProperties } from "@/lib/api";
import { PropertyCard } from "@/components/property-card";
import { FOCUS_AREAS, UNIT_TYPES, PRICE_BANDS, SORT_OPTIONS } from "@/lib/types";

export const metadata = {
  title: "Properties | Chestone Properties Ltd",
  description: "Browse available properties in Kilimani, Kileleshwa, Westlands, Lavington, Karen, and Riverside Drive.",
};

type RawSearchParams = { area?: string; type?: string; price?: string; sort?: string };

// Builds a /properties URL carrying every currently-active filter plus one
// override -- so switching e.g. price band never resets area/type/sort.
function buildHref(current: RawSearchParams, override: RawSearchParams): string {
  const merged = { ...current, ...override };
  const params = new URLSearchParams();
  if (merged.area) params.set("area", merged.area);
  if (merged.type) params.set("type", merged.type);
  if (merged.price) params.set("price", merged.price);
  if (merged.sort) params.set("sort", merged.sort);
  const qs = params.toString();
  return qs ? `/properties?${qs}` : "/properties";
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const activeArea = FOCUS_AREAS.find((a) => a.toLowerCase() === params.area?.toLowerCase());
  const activeType = UNIT_TYPES.find((t) => t.toLowerCase() === params.type?.toLowerCase());
  const activePriceBand = PRICE_BANDS.find((b) => b.value === params.price);
  const activeSort = SORT_OPTIONS.find((s) => s.value === params.sort);

  const properties = await getProperties({
    area: activeArea,
    type: activeType,
    price: activePriceBand?.value,
    sort: activeSort?.value,
  }).catch(() => []);

  return (
    <div className="container-page py-16 md:py-20">
      <div className="max-w-2xl">
        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Listings</span>
        <h1 className="mt-3 font-serif text-4xl font-semibold text-navy">
          {activeArea ? `Properties in ${activeArea}` : "All Properties"}
        </h1>
        <p className="mt-3 text-sm text-stone">
          {properties.length} {properties.length === 1 ? "property" : "properties"} available
          {activeArea ? ` in ${activeArea}` : " across our focus areas"}.
        </p>
      </div>

      {/* Area filter pills */}
      <div className="scroll-pills -mx-4 mt-8 flex flex-nowrap gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
        <Link
          href={buildHref(params, { area: undefined })}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            !activeArea ? "bg-navy text-white" : "bg-white text-ink ring-1 ring-black/10 hover:ring-navy/30"
          }`}
        >
          All Areas
        </Link>
        {FOCUS_AREAS.map((a) => (
          <Link
            key={a}
            href={buildHref(params, { area: a })}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeArea === a ? "bg-navy text-white" : "bg-white text-ink ring-1 ring-black/10 hover:ring-navy/30"
            }`}
          >
            {a}
          </Link>
        ))}
      </div>

      {/* Type filter pills */}
      <div className="scroll-pills -mx-4 mt-3 flex flex-nowrap items-center gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-stone">Type:</span>
        <Link
          href={buildHref(params, { type: undefined })}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            !activeType ? "bg-gold text-navy" : "bg-white text-ink ring-1 ring-black/10 hover:ring-gold/50"
          }`}
        >
          Any
        </Link>
        {UNIT_TYPES.map((t) => (
          <Link
            key={t}
            href={buildHref(params, { type: t })}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              activeType === t ? "bg-gold text-navy" : "bg-white text-ink ring-1 ring-black/10 hover:ring-gold/50"
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      {/* Price band filter pills */}
      <div className="scroll-pills -mx-4 mt-3 flex flex-nowrap items-center gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-stone">Price:</span>
        <Link
          href={buildHref(params, { price: undefined })}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            !activePriceBand ? "bg-gold text-navy" : "bg-white text-ink ring-1 ring-black/10 hover:ring-gold/50"
          }`}
        >
          Any
        </Link>
        {PRICE_BANDS.map((b) => (
          <Link
            key={b.value}
            href={buildHref(params, { price: b.value })}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              activePriceBand?.value === b.value ? "bg-gold text-navy" : "bg-white text-ink ring-1 ring-black/10 hover:ring-gold/50"
            }`}
          >
            {b.label}
          </Link>
        ))}
      </div>

      {/* Sort */}
      <div className="scroll-pills -mx-4 mt-4 flex flex-nowrap items-center gap-3 overflow-x-auto border-t border-black/5 px-4 pb-1 pt-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-stone">Sort:</span>
        <Link
          href={buildHref(params, { sort: undefined })}
          className={`shrink-0 text-xs font-medium underline-offset-4 transition-colors ${
            !activeSort ? "text-navy underline" : "text-stone hover:text-navy"
          }`}
        >
          Newest
        </Link>
        {SORT_OPTIONS.map((s) => (
          <Link
            key={s.value}
            href={buildHref(params, { sort: s.value })}
            className={`shrink-0 text-xs font-medium underline-offset-4 transition-colors ${
              activeSort?.value === s.value ? "text-navy underline" : "text-stone hover:text-navy"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {/* Results */}
      {properties.length > 0 ? (
        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      ) : (
        <div className="mt-20 flex flex-col items-center gap-2 text-center">
          <p className="font-serif text-xl text-navy">No properties here just yet</p>
          <p className="text-sm text-stone">Check back soon, or browse another area.</p>
        </div>
      )}
    </div>
  );
}
