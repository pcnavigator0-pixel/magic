import { PublicPageShell } from "@/app/components/public-shell";
import { getMagicData } from "@/lib/magic-data";
import { NewsPostList } from "./news-post-list";

export default async function NewsPage() {
  const data = await getMagicData();

  return (
    <PublicPageShell
      eyebrow="News"
      title="Latest MAGIC BBC stories"
      description="Read every published update, article, and club note in one place."
    >
      <NewsPostList posts={data.news} />
      {data.news.length === 0 && <p className="public-empty">No news has been published yet.</p>}
    </PublicPageShell>
  );
}
