import { getMagicData } from "@/lib/magic-data";
import { siteUrl } from "@/lib/site-config";

export const revalidate = 3600;

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function urlEntry(url: string, lastModified?: string) {
  return [
    "  <url>",
    `    <loc>${escapeXml(url)}</loc>`,
    lastModified ? `    <lastmod>${escapeXml(lastModified)}</lastmod>` : "",
    "  </url>",
  ].filter(Boolean).join("\n");
}

export async function GET() {
  const data = await getMagicData();
  const staticPaths = ["/", "/news", "/matches", "/standings", "/events", "/roster", "/shop"];
  const staticEntries = staticPaths.map((path) => urlEntry(`${siteUrl}${path}`));
  const newsEntries = data.news
    .filter((post) => post.is_published)
    .map((post) => urlEntry(`${siteUrl}/news/${post.slug}`, new Date(post.published_at).toISOString().slice(0, 10)));

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...staticEntries,
    ...newsEntries,
    "</urlset>",
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
