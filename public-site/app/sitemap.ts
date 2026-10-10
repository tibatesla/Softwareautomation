import type { MetadataRoute } from "next";
import { getProperties } from "@/lib/api";
import { propertyUrl } from "@/lib/slug";
import { LANDING_AREAS, availableTypes } from "@/lib/landing-pages";

const SITE_URL = "https://www.chestoneproperties.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const properties = await getProperties().catch(() => []);
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/properties`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/privacy-policy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const perArea = await Promise.all(
    LANDING_AREAS.map(async (area) => ({ area, all: await getProperties({ area }).catch(() => []) })),
  );

  // Empty areas (e.g. Runda until stocked) stay out of the sitemap.
  const areaRoutes: MetadataRoute.Sitemap = perArea
    .filter(({ all }) => all.length > 0)
    .map(({ area }) => ({
      url: `${SITE_URL}/areas/${encodeURIComponent(area)}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  const landingRoutes: MetadataRoute.Sitemap = perArea.flatMap(({ area, all }) =>
    availableTypes(all).map((t) => ({
      url: `${SITE_URL}/areas/${encodeURIComponent(area)}/${t.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  );

  const propertyRoutes: MetadataRoute.Sitemap = properties.map((property) => ({
    url: `${SITE_URL}${propertyUrl(property)}`,
    lastModified: property.createdAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...areaRoutes, ...landingRoutes, ...propertyRoutes];
}
