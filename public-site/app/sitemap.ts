import type { MetadataRoute } from "next";
import { getProperties } from "@/lib/api";

const SITE_URL = "https://chestoneproperties.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const properties = await getProperties().catch(() => []);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/properties`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/faq`, changeFrequency: "monthly", priority: 0.5 },
  ];

  const propertyRoutes: MetadataRoute.Sitemap = properties.map((property) => ({
    url: `${SITE_URL}/properties/${property.id}`,
    lastModified: property.createdAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const developments = [...new Set(properties.map((p) => p.developmentName).filter((d): d is string => Boolean(d)))];
  const developmentRoutes: MetadataRoute.Sitemap = developments.map((name) => ({
    url: `${SITE_URL}/developments/${encodeURIComponent(name)}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...developmentRoutes, ...propertyRoutes];
}
