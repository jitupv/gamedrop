import type { MetadataRoute } from "next";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} - ${SITE_TAGLINE}`,
    short_name: SITE_NAME,
    description: "Seven original games. Fresh challenges, free to play in your browser.",
    start_url: "/",
    display: "standalone",
    background_color: "#12151b",
    theme_color: "#12151b",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      // PNG fallbacks - some Android WebAPK installers don't rasterize SVG
      // manifest icons reliably, so a home-screen install can silently fall
      // back to a generic icon without these
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/icon-192-maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
