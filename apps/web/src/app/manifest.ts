import type { MetadataRoute } from "next";

/**
 * Makes the app installable on a phone's home screen. Chrome and Safari only
 * need this manifest, its icons and HTTPS: no service worker, because the
 * app has no offline mode. (Next.js serves this at /manifest.webmanifest and
 * adds the <link> tag itself.)
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HullOps",
    short_name: "HullOps",
    description: "Planning for cleaning and protection work on shipyards",
    // Open on the work, not on a landing page. Without a session the proxy
    // sends the user on to the login page.
    start_url: "/orders",
    // No browser bars: it looks and behaves like an app.
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0369a1",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        // Android may crop this one to a circle; the letter stays in the middle.
        purpose: "maskable",
      },
    ],
  };
}
