import type { MetadataRoute } from "next";

const SITE_URL = "https://chestoneproperties.com";

export default function robots(): MetadataRoute.Robots {
  return {
    // /book/ links are single-use and per-lead -- never worth indexing,
    // and a stale one is just a dead 404 once its token is cleared anyway.
    rules: { userAgent: "*", allow: "/", disallow: "/book/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
