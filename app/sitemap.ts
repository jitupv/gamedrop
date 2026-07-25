import type { MetadataRoute } from "next";
import { GUIDE_ORDER } from "@/lib/gameContent";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];
  for (const id of GUIDE_ORDER) {
    // the playable game changes daily; its guide is stable reference content
    routes.push({ url: `${SITE_URL}/${id}`, changeFrequency: "daily", priority: 0.9 });
    routes.push({ url: `${SITE_URL}/${id}/how-to-play`, changeFrequency: "monthly", priority: 0.6 });
  }
  return routes;
}
