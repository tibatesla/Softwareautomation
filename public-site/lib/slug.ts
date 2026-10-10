// lib/slug.ts
import { PublicProperty } from "./types";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function slugify(text: string): string {
  const expanded = text
    .replace(/(\d)\s*Br\b/gi, "$1 Bedroom")
    .replace(/\bBr\b/gi, "Bedroom");
  return expanded
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Clean, SEO-friendly URL, made collision-proof with referenceId:
//   /properties/2-bedroom-apartment-westlands-gvg-002a
// referenceId is the natural unique key already in the data model -- two
// properties can share a title (e.g. two "2 Bedroom Apartment" units in
// different developments), but never a referenceId. Properties without a
// referenceId fall back to the plain title slug, which keeps old links
// working for anything generated before this change.
export function propertyUrl(property: Pick<PublicProperty, "title" | "referenceId">): string {
  const base = slugify(property.title);
  if (!property.referenceId) return `/properties/${base}`;

  const refSlug = slugify(property.referenceId);
  return base.endsWith(refSlug) ? `/properties/${base}` : `/properties/${base}-${refSlug}`;
}

// Fallback for old links that still contain a raw UUID anywhere in the segment
export function extractUuid(param: string): string | null {
  const match = param.match(UUID_RE);
  return match ? match[0] : null;
}
