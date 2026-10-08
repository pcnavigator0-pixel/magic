import Link from "next/link";
import { PrintOnLoad } from "@/app/components/print-on-load";
import { notFound } from "next/navigation";
import { ArticleBody } from "@/app/components/article-body";
import { NewsEngagement } from "@/app/components/news-engagement";
import { NewsImageCarousel } from "@/app/components/news-image-carousel";
import { PublicFooter } from "@/app/components/public-shell";
import { SiteHeader } from "@/app/components/site-header";
import { formatDisplayDate, getMagicData, getNewsPostById, getNewsPostBySlug, recordNewsView } from "@/lib/magic-data";

export const dynamic = "force-dynamic";

export default async function NewsArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { slug } = await params;
  const { print } = await searchParams;
  const post = await getNewsPostBySlug(slug);

  if (!post) notFound();

  const recordedViewCount = await recordNewsView(post.id);
  const displayedPost = {
    ...post,
    view_count: recordedViewCount ?? post.view_count ?? 0,
  };

  const [previousNews, nextNews, matchData] = await Promise.all([
    post.previous_news_id ? getNewsPostById(post.previous_news_id) : Promise.resolve(null),
    post.next_news_id ? getNewsPostById(post.next_news_id) : Promise.resolve(null),
    getMagicData(),
  ]);

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
            <div className="article-meta">{formatDisplayDate(displayedPost.published_at)} - Magic Basketball Initiatives <span className="news-view-count"><i className="fa-solid fa-eye" aria-hidden="true" /> {displayedPost.view_count} views</span></div>
            {displayedPost.excerpt && <p>{displayedPost.excerpt}</p>}
          </header>

          {post.image_url && (
            <NewsImageCarousel
              imageValue={post.image_url}
              alt={displayedPost.title}
              className="article-cover"
              placeholderClassName="news-image-placeholder news-image-placeholder-large"
            />
          )}

          <ArticleBody blocks={displayedPost.content} fallbackText={displayedPost.excerpt} matches={matchData.matches} />

          <NewsEngagement
            postId={displayedPost.id}
            title={displayedPost.title}
            viewCount={displayedPost.view_count}
            likeCount={displayedPost.like_count || 0}
            dislikeCount={displayedPost.dislike_count || 0}
            commentCount={displayedPost.comment_count || 0}
          />

          {(previousNews || nextNews) && (
            <nav className="article-sequence" aria-label="Related news sequence">
              {previousNews ? (
                <Link className="article-sequence-link article-sequence-previous" href={`/news/${previousNews.slug}`}>
                  <span>Previous story</span>
                  <strong><i className="fa-solid fa-arrow-left" aria-hidden="true" /> {previousNews.title}</strong>
                </Link>
              ) : <span />}
              {nextNews ? (
                <Link className="article-sequence-link article-sequence-next" href={`/news/${nextNews.slug}`}>
                  <span>Next story</span>
                  <strong>{nextNews.title} <i className="fa-solid fa-arrow-right" aria-hidden="true" /></strong>
                </Link>
              ) : <span />}
            </nav>
          )}
        </article>
      </main>
      <PublicFooter />
      {print === "1" && <PrintOnLoad />}
    </>
  );
}
