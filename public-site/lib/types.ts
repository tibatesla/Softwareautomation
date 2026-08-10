export type PropertyStatus = "available" | "reserved";

// Matches PUBLIC_PROPERTY_SELECT in src/controllers/public-property.controller.ts
// exactly -- internal-only fields (assignedAgentId, createdBy, developer
// contact details) are never returned by that endpoint, so they don't
// appear here either.
export interface PublicProperty {
  id: string;
  referenceId: string | null;
  title: string;
  description: string | null;
  location: string | null;
  subLocation: string | null;
  price: string;
  priceMin: string | null;
  priceMax: string | null;
  currency: string;
  status: PropertyStatus;
  unitType: string | null;
  totalUnits: number | null;
  levelFloors: number | null;
  view: string | null;
  completionTime: string | null;
  paymentPlanStructure: string | null;
  houseSizeSqft: string | null;
  amenities: string[];
  images: string[];
  videos: string[];
  createdAt: string;
}

export const FOCUS_AREAS = ["Kilimani", "Kileleshwa", "Westlands", "Lavington", "Karen", "Riverside"] as const;
export type FocusArea = (typeof FOCUS_AREAS)[number];

export const UNIT_TYPES = ["Apartment", "Villa", "Townhouse"] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

// Matches PUBLIC_PRICE_BANDS in src/controllers/public-property.controller.ts.
export const PRICE_BANDS: { value: string; label: string }[] = [
  { value: "under-20m", label: "Under KES 20M" },
  { value: "20m-40m", label: "KES 20M – 40M" },
  { value: "40m-60m", label: "KES 40M – 60M" },
  { value: "60m-plus", label: "KES 60M+" },
];

export const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
];
