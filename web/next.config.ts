import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    // Next 15+ defaults optimized image responses to Content-Disposition:
    // attachment, which some Chromium versions refuse to render inline via
    // <img> -- confirmed live (naturalWidth 0, complete: false) on the
    // sidebar/login logo. Safe to force inline here: every optimized image
    // in this app is our own local JPEG (logo/property photos), not
    // user-uploaded SVG, so there's no XSS risk 'attachment' guards against.
    contentDispositionType: "inline",
  },
};

export default nextConfig;
