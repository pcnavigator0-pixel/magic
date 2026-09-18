import type { MetadataRoute } from "next";
import { getMagicData } from "@/lib/magic-data";
import { siteUrl } from "@/lib/site-config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await getMagicData();
  const now = new Date();
  const staticRoutes = ["", "/news", "/matches", "/standings", "/events", "/roster", "/shop"].map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: now,
    changeFrequency: path === "/news" || path === "/matches" ? "daily" as const : "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));
  const newsRoutes = data.news
    .filter((post) => post.is_published)
    .map((post) => ({
      url: `${siteUrl}/news/${post.slug}`,
      lastModified: new Date(post.published_at),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

  return [...staticRoutes, ...newsRoutes];
}
