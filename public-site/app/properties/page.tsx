import Link from "next/link";
import { getProperties } from "@/lib/api";
import { PropertyCard } from "@/components/property-card";
import { FOCUS_AREAS, UNIT_TYPES, PRICE_BANDS, SIZE_BANDS, SORT_OPTIONS } from "@/lib/types";

export const metadata = {
  title: "Properties | Chestone Properties Ltd",
  description: "Browse available properties in Kilimani, Kileleshwa, Westlands, Lavington, Karen, and Riverside Drive.",
};

type RawSearchParams = {
  area?: string;
  type?: string;
  price?: string;
  size?: string;
  development?: string;
  sort?: string;
  view?: string;
};

// Builds a /properties URL carrying every currently-active filter plus one
// override -- so switching e.g. price band never resets area/type/sort.
function buildHref(current: RawSearchParams, override: RawSearchParams): string {
  const merged = { ...current, ...override };
  const params = new URLSearchParams();
  if (merged.area) params.set("area", merged.area);
  if (merged.type) params.set("type", merged.type);
  if (merged.price) params.set("price", merged.price);
  if (merged.size) params.set("size", merged.size);
  if (merged.development) params.set("development", merged.development);
  if (merged.sort) params.set("sort", merged.sort);
  if (merged.view) params.set("view", merged.view);
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
  const activeSizeBand = SIZE_BANDS.find((b) => b.value === params.size);
  const activeSort = SORT_OPTIONS.find((s) => s.value === params.sort);
  const view = params.view === "list" ? "list" : "grid";

  // Fetched unfiltered, purely to derive the full list of developments to
  // offer as filter options -- so the facet list never narrows itself away
  // as other filters get applied (same UX PRICE_BANDS/SIZE_BANDS give,
  // since those are fixed; this one has to be derived from real data).
  const [properties, allProperties] = await Promise.all([
    getProperties({
      area: activeArea,
      type: activeType,
      price: activePriceBand?.value,
      size: activeSizeBand?.value,
      development: params.development,
      sort: activeSort?.value,
    }).catch(() => []),
    getProperties().catch(() => []),
  ]);

  const developments = [...new Set(allProperties.map((p) => p.developmentName).filter((d): d is string => Boolean(d)))].sort();
  const activeDevelopment = developments.find((d) => d.toLowerCase() === params.development?.toLowerCase());

  return (
    <div className="container-page py-16 md:py-20">
      <div className="max-w-2xl">
        <span className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">Listings</span>
        <h1 className="mt-3 font-serif text-4xl font-semibold text-ivory">
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
            !activeArea ? "bg-gold text-onyx" : "bg-onyx-light text-stone ring-1 ring-white/10 hover:ring-gold/40"
          }`}
        >
          All Areas
        </Link>
        {FOCUS_AREAS.map((a) => (
          <Link
            key={a}
            href={buildHref(params, { area: a })}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeArea === a ? "bg-gold text-onyx" : "bg-onyx-light text-stone ring-1 ring-white/10 hover:ring-gold/40"
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
            !activeType ? "bg-gold text-onyx" : "bg-onyx-light text-stone ring-1 ring-white/10 hover:ring-gold/40"
          }`}
        >
          Any
        </Link>
        {UNIT_TYPES.map((t) => (
          <Link
            key={t}
            href={buildHref(params, { type: t })}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              activeType === t ? "bg-gold text-onyx" : "bg-onyx-light text-stone ring-1 ring-white/10 hover:ring-gold/40"
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
            !activePriceBand ? "bg-gold text-onyx" : "bg-onyx-light text-stone ring-1 ring-white/10 hover:ring-gold/40"
          }`}
        >
          Any
        </Link>
        {PRICE_BANDS.map((b) => (
          <Link
            key={b.value}
            href={buildHref(params, { price: b.value })}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              activePriceBand?.value === b.value ? "bg-gold text-onyx" : "bg-onyx-light text-stone ring-1 ring-white/10 hover:ring-gold/40"
            }`}
          >
            {b.label}
          </Link>
        ))}
      </div>

      {/* Size band filter pills */}
      <div className="scroll-pills -mx-4 mt-3 flex flex-nowrap items-center gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-stone">Size:</span>
        <Link
          href={buildHref(params, { size: undefined })}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            !activeSizeBand ? "bg-gold text-onyx" : "bg-onyx-light text-stone ring-1 ring-white/10 hover:ring-gold/40"
          }`}
        >
          Any
        </Link>
        {SIZE_BANDS.map((b) => (
          <Link
            key={b.value}
            href={buildHref(params, { size: b.value })}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              activeSizeBand?.value === b.value ? "bg-gold text-onyx" : "bg-onyx-light text-stone ring-1 ring-white/10 hover:ring-gold/40"
            }`}
          >
            {b.label}
          </Link>
        ))}
      </div>

      {/* Development/project filter pills -- only rendered when there's
          actually more than one development to distinguish between. */}
      {developments.length > 0 && (
        <div className="scroll-pills -mx-4 mt-3 flex flex-nowrap items-center gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-stone">Project:</span>
          <Link
            href={buildHref(params, { development: undefined })}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              !activeDevelopment ? "bg-gold text-onyx" : "bg-onyx-light text-stone ring-1 ring-white/10 hover:ring-gold/40"
            }`}
          >
            Any
          </Link>
          {developments.map((d) => (
            <Link
              key={d}
              href={buildHref(params, { development: d })}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                activeDevelopment === d ? "bg-gold text-onyx" : "bg-onyx-light text-stone ring-1 ring-white/10 hover:ring-gold/40"
              }`}
            >
              {d}
            </Link>
          ))}
        </div>
      )}

      {/* Sort + view toggle */}
      <div className="scroll-pills -mx-4 mt-4 flex flex-nowrap items-center justify-between gap-3 overflow-x-auto border-t border-white/10 px-4 pb-1 pt-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        <div className="flex shrink-0 items-center gap-3">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-stone">Sort:</span>
          <Link
            href={buildHref(params, { sort: undefined })}
            className={`shrink-0 text-xs font-medium underline-offset-4 transition-colors ${
              !activeSort ? "text-gold underline" : "text-stone hover:text-ivory"
            }`}
          >
            Newest
          </Link>
          {SORT_OPTIONS.map((s) => (
            <Link
              key={s.value}
              href={buildHref(params, { sort: s.value })}
              className={`shrink-0 text-xs font-medium underline-offset-4 transition-colors ${
                activeSort?.value === s.value ? "text-gold underline" : "text-stone hover:text-ivory"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-1 rounded-full bg-onyx-light p-1 ring-1 ring-white/10">
          <Link
            href={buildHref(params, { view: "grid" })}
            aria-label="Grid view"
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${view === "grid" ? "bg-gold text-onyx" : "text-stone hover:text-ivory"}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </Link>
          <Link
            href={buildHref(params, { view: "list" })}
            aria-label="List view"
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${view === "list" ? "bg-gold text-onyx" : "text-stone hover:text-ivory"}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="6" x2="20" y2="6" strokeLinecap="round" />
              <line x1="4" y1="12" x2="20" y2="12" strokeLinecap="round" />
              <line x1="4" y1="18" x2="20" y2="18" strokeLinecap="round" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Results */}
      {properties.length > 0 ? (
        <div className={view === "grid" ? "mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3" : "mt-12 flex flex-col gap-4"}>
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} view={view} />
          ))}
        </div>
      ) : (
        <div className="mt-20 flex flex-col items-center gap-2 text-center">
          <p className="font-serif text-xl text-ivory">No properties here just yet</p>
          <p className="text-sm text-stone">Check back soon, or browse another area.</p>
        </div>
      )}
    </div>
  );
}
