import type { Property } from "@/lib/types";

/** Properties sharing a development name are grouped into one collapsible
 * row; everything else lists individually, same as before. Order is
 * preserved -- a group's header appears at the position of its first
 * member, not resorted to the top or bottom. */
export function groupByDevelopment(properties: Property[]): (Property | { development: string; units: Property[] })[] {
  const seen = new Set<string>();
  const rows: (Property | { development: string; units: Property[] })[] = [];
  for (const property of properties) {
    const key = property.developmentName?.trim();
    if (!key) {
      rows.push(property);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ development: key, units: properties.filter((p) => p.developmentName?.trim() === key) });
  }
  return rows;
}

/** How many listings to show as "the property count": each development
 * counts once regardless of how many unit variants it has, each standalone
 * property counts once. Matches what the grouped table actually displays,
 * rather than the raw per-unit row count. */
export function countPropertyListings(properties: Property[]): number {
  return groupByDevelopment(properties).length;
}
