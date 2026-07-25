// One source of truth for the canonical site origin. Used by metadata, canonical
// tags, sitemap, robots, and JSON-LD so they never drift apart.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://gamesdrop.vercel.app";

export const SITE_NAME = "GAMEDROP";
