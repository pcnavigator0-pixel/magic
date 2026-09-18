import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/news", "/matches", "/standings", "/events", "/roster", "/shop"],
      disallow: ["/login", "/portal/", "/coach-dashboard", "/player-dashboard", "/api/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
