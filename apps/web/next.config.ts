import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // Cache-Control tells the browser and the CDN how long they may keep a file.
  // Pages and API answers are never cached (they are per user and must be
  // fresh), and Next.js already caches its hashed JavaScript and CSS for a
  // year. The icons and the manifest rarely change, so keeping them for a
  // while saves a request per visit on a slow connection; if one changes, it
  // is picked up within the time below.
  async headers() {
    return [
      {
        source: "/icons/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
      {
        source: "/apple-icon.png",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
      },
    ];
  },
};

// Loads the per-request language and messages from src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
