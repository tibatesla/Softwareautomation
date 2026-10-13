import { FOCUS_AREAS, type PublicProperty } from "./types";

export const LANDING_AREAS = ["Westlands", "Kilimani", "Kileleshwa", "Lavington", "Riverside", "Karen", "Runda"] as const;
export type LandingArea = (typeof LANDING_AREAS)[number];

// A type page only exists when it has at least this many live listings.
export const MIN_LISTINGS = 3;

export type LandingType = {
  slug: string;
  label: string;
  blurb: string;
  match: (p: PublicProperty) => boolean;
  cap?: number; // budget tiers only
};

const hay = (p: PublicProperty) => `${p.title} ${p.unitType ?? ""}`;
const isPenthouse = (p: PublicProperty) => /penthouse/i.test(hay(p));
const isVilla = (p: PublicProperty) => /villa|detached|smart home/i.test(hay(p));
const isOffPlan = (p: PublicProperty) => /off-?plan/i.test(`${hay(p)} ${p.description ?? ""}`);
const isFlat = (p: PublicProperty) => !isPenthouse(p) && !isVilla(p);
const startsAt = (p: PublicProperty) => Number(p.priceMin) || Number(p.price) || 0;

export function bedrooms(p: PublicProperty): number | null {
  const m = (p.unitType ?? "").match(/(\d+)\s*-?\s*(?:bed|br)/i) ?? p.title.match(/(\d+)\s*-?\s*(?:bed|br)/i);
  return m ? Number(m[1]) : null;
}

function budgetType(capM: number): LandingType {
  return {
    slug: `under-${capM}m`,
    label: `Apartments Under KES ${capM}M`,
    cap: capM * 1_000_000,
    blurb: `Units with a starting price of KES ${capM} million or less. Final price depends on floor, size and finish; each listing shows its range.`,
    match: (p) => isFlat(p) && startsAt(p) > 0 && startsAt(p) <= capM * 1_000_000,
  };
}

export const LANDING_TYPES: LandingType[] = [
  {
    slug: "off-plan",
    label: "Off-Plan Apartments",
    blurb: "Off-plan units are sold before completion. Confirm the completion timeline and payment plan structure for each project before reserving; each listing shows what we have on file.",
    match: isOffPlan,
  },
  {
    slug: "studio",
    label: "Studio Apartments",
    blurb: "Studios are compact, lower-entry-price units that suit single occupants and investors comparing rental stock.",
    match: (p) => isFlat(p) && bedrooms(p) === null && /studio/i.test(hay(p)),
  },
  {
    slug: "1-bedroom",
    label: "1 Bedroom Apartments",
    blurb: "One-bedroom units suit professionals, couples and investors looking for rentable stock.",
    match: (p) => isFlat(p) && bedrooms(p) === 1,
  },
  {
    slug: "2-bedroom",
    label: "2 Bedroom Apartments",
    blurb: "Two-bedroom units balance space and price for small families, sharers and owner-occupiers.",
    match: (p) => isFlat(p) && bedrooms(p) === 2,
  },
  {
    slug: "3-bedroom",
    label: "3 Bedroom Apartments",
    blurb: "Three-bedroom units are family-sized; many include a domestic staff quarter (DSQ), noted on each listing.",
    match: (p) => isFlat(p) && bedrooms(p) === 3,
  },
  {
    slug: "4-bedroom",
    label: "4 Bedroom Apartments",
    blurb: "Four-bedroom residences for larger families; many include a domestic staff quarter (DSQ), noted on each listing.",
    match: (p) => isFlat(p) && bedrooms(p) === 4,
  },
  {
    slug: "5-bedroom",
    label: "5+ Bedroom Residences",
    blurb: "Five-bedroom and larger residences for families wanting maximum space within the city.",
    match: (p) => isFlat(p) && (bedrooms(p) ?? 0) >= 5,
  },
  ...[10, 15, 20, 30, 50].map(budgetType),
  {
    slug: "penthouses",
    label: "Penthouses",
    blurb: "Top-floor residences, usually multi-level or with larger internal areas than standard units.",
    match: isPenthouse,
  },
  {
    slug: "villas",
    label: "Villas and Detached Homes",
    blurb: "Standalone homes with private grounds, for buyers prioritising space and privacy.",
    match: isVilla,
  },
];

export function matchLandingArea(name: string): LandingArea | undefined {
  const d = decodeURIComponent(name).toLowerCase();
  return LANDING_AREAS.find((a) => a.toLowerCase() === d);
}

export function getLandingType(slug: string): LandingType | undefined {
  return LANDING_TYPES.find((t) => t.slug === slug.toLowerCase());
}

export function filterByType(list: PublicProperty[], t: LandingType): PublicProperty[] {
  return list.filter(t.match);
}

export function availableTypes(list: PublicProperty[]): LandingType[] {
  let prevBudget = 0;
  return LANDING_TYPES.filter((t) => {
    const n = filterByType(list, t).length;
    if (n < MIN_LISTINGS) {
      if (t.cap) prevBudget = n;
      return false;
    }
    if (!t.cap) return true;
    const fresh = n - prevBudget >= MIN_LISTINGS;
    prevBudget = n;
    return fresh;
  });
}

export function formatMillions(n: number): string {
  return `KES ${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

// SEO headline per area, chosen from the Google Ads keyword plan. Used for the
// <title>, H1, JSON-LD name and Open Graph/Twitter tags so they always agree.
export const AREA_HEADLINES: Record<string, string> = {
  Westlands: "Apartments for Sale in Westlands, Nairobi",
  Kilimani: "Apartments for Sale in Kilimani, Nairobi",
  Kileleshwa: "Apartments for Sale in Kileleshwa, Nairobi",
  Lavington: "Apartments for Sale in Lavington, Nairobi",
  Riverside: "Apartments for Sale in Riverside, Nairobi",
  Karen: "Villas for Sale in Karen, Nairobi",
  Runda: "Villas for Sale in Runda, Nairobi",
};

export function areaHeadline(area: string): string {
  return AREA_HEADLINES[area] ?? `Properties for Sale in ${area}, Nairobi`;
}

// Link from a listing to its area landing page. Listing locations look like
// "Karen, Nairobi", so match on the part before the comma. Falls back to the
// filtered /properties page if the area isn't one of FOCUS_AREAS.
export function areaHref(location: string): string {
  const first = location.split(",")[0].trim().toLowerCase();
  const area = FOCUS_AREAS.find((a) => a.toLowerCase() === first);
  return area
    ? `/areas/${encodeURIComponent(area)}`
    : `/properties?area=${encodeURIComponent(location)}`;
}
