// lib/resolve-property.ts
//
// Resolves a URL segment (which may be an old raw UUID, a new
// title+referenceId slug, or an old plain-title-only slug) back to the
// real property record.

import { getProperties, getProperty } from "./api";
import { slugify, extractUuid, propertyUrl } from "./slug";
import type { PublicProperty } from "./types";

export async function resolveProperty(param: string): Promise<PublicProperty | null> {
  // Fast path: old links that still embed a raw UUID
  const uuid = extractUuid(param);
  if (uuid) {
    const byId = await getProperty(uuid).catch(() => null);
    if (byId) return byId;
  }

  const properties = await getProperties().catch(() => []);

  // Primary path: current collision-proof slug (title + referenceId)
  const exact = properties.find((p) => propertyUrl(p) === `/properties/${param}`);
  if (exact) return exact;

  // Backward-compat path: old plain-title-only slugs, for any links
  // generated/shared before referenceId was added to the URL. If more than
  // one property matches, this is genuinely ambiguous -- return the first
  // rather than guessing further; the exact path above is what prevents
  // this ambiguity for every property going forward.
  const byTitleOnly = properties.find((p) => slugify(p.title) === param);
  return byTitleOnly ?? null;
}
