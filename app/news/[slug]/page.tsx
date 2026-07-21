import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleBody } from "@/app/components/article-body";
import { NewsImageCarousel } from "@/app/components/news-image-carousel";
import { PublicFooter } from "@/app/components/public-shell";
import { SiteHeader } from "@/app/components/site-header";
import { formatDisplayDate, getNewsPostBySlug } from "@/lib/magic-data";

export const dynamic = "force-dynamic";

export default async function NewsArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getNewsPostBySlug(slug);

  if (!post) notFound();

  return (
    <>
      <SiteHeader />
      <main className="public-page">
        <article className="article-page">
          <Link className="article-back-link" href="/news">
            <i className="fa-solid fa-arrow-left" aria-hidden="true" />
            Back to News
          </Link>

          <header className="article-header">
            <span>{post.category}</span>
            <h1>{post.title}</h1>
            <div className="article-meta">{formatDisplayDate(post.published_at)} - Magic Initiative Rwanda</div>
            {post.excerpt && <p>{post.excerpt}</p>}
          </header>

          {post.image_url && (
            <NewsImageCarousel
              imageValue={post.image_url}
              alt={post.title}
              className="article-cover"
              placeholderClassName="news-image-placeholder news-image-placeholder-large"
            />
          )}

          <ArticleBody blocks={post.content} fallbackText={post.excerpt} />
        </article>
      </main>
      <PublicFooter />
    </>
  );
}
