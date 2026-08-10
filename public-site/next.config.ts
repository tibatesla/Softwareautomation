import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    // Next 15+ defaults optimized image responses to Content-Disposition:
    // attachment, which some Chromium versions refuse to render inline via
    // <img> -- confirmed on the CRM frontend during the same build.
    contentDispositionType: "inline",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
