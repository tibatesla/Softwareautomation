import type { MetadataRoute } from "next";

// Matches sitemap.ts -- www is the real served domain (bare domain 301s to it).
const SITE_URL = "https://www.chestoneproperties.com";

export default function robots(): MetadataRoute.Robots {
  return {
    // /book/ links are single-use and per-lead -- never worth indexing,
    // and a stale one is just a dead 404 once its token is cleared anyway.
    rules: { userAgent: "*", allow: "/", disallow: "/book/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
