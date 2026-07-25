import type { MetadataRoute } from "next";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} - ${SITE_TAGLINE}`,
    short_name: SITE_NAME,
    description: "Six original games. A fresh daily challenge in every one. Play today's free.",
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
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
