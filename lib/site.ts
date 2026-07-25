// One source of truth for the brand and canonical origin. Used by metadata,
// canonical tags, sitemap, robots, JSON-LD and the share cards so they never
// drift apart. A future rename should only touch this file plus page copy.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://gamesdrop.vercel.app";

export const SITE_NAME = "JEETLE";

// The domain people should remember - printed on share cards and the footer.
// Deliberately NOT derived from SITE_URL: we keep deploying on Vercel until
// jeetle.games is bought and pointed at the project.
export const SITE_DOMAIN = "jeetle.games";

// Public contact address, shown in the footer and on the text pages.
export const SITE_EMAIL = "contact@jeetle.games";

// The one-line promise. The daily challenge is what the code guarantees
// forever, so the tagline leans on that rather than on a release cadence.
export const SITE_TAGLINE = "a fresh challenge every midnight";
