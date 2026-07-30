/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Every page's HTML shell must always revalidate. Without this, a
        // rarely-refreshed surface (a home-screen PWA shortcut that's just
        // tapped open, never pull-to-refreshed) can keep serving an HTML
        // shell from a previous deploy - which points at an OLD JS bundle -
        // long after a regular browser tab has picked up the latest one.
        // That is the most likely explanation for "the shortcut shows a
        // different score than the browser tab": they were literally
        // running different versions of the app at the same time.
        source: "/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
      // Production build assets are content-hashed, so a new deploy gets new
      // filenames and caching forever is safe. In dev the chunk names are
      // stable across recompiles, so the same header would pin a stale bundle
      // in the browser for a year and no amount of reloading would pick up an
      // edit - hence production only.
      ...(process.env.NODE_ENV === "production"
        ? [
            {
              source: "/_next/static/:path*",
              headers: [
                { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
              ],
            },
          ]
        : []),
    ];
  },
};

export default nextConfig;
