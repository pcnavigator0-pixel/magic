import Link from "next/link";
import { NewsImageCarousel } from "@/app/components/news-image-carousel";
import type { NewsPost } from "@/lib/magic-data";
import { formatDisplayDate } from "@/lib/magic-data";

type NewsPostListProps = {
  posts: NewsPost[];
};

export function NewsPostList({ posts }: NewsPostListProps) {
  const publishedPosts = posts.filter((post) => post.is_published);

  return (
    <section className="public-grid news-masonry-grid">
      {publishedPosts.map((post) => (
        <article className="public-card news-public-card news-card-button" key={post.id}>
          <Link className="news-card-link" href={`/news/${post.slug}`}>
            <div className="news-card-media">
              <NewsImageCarousel imageValue={post.image_url} alt={post.title} />
              <span className="news-card-overlay">
                Read Full Story
                <i className="fa-solid fa-arrow-right" aria-hidden="true" />
              </span>
            </div>
            <div className="news-card-body">
              <span>{post.category}</span>
              <h2>{post.title}</h2>
              {post.excerpt && <p>{post.excerpt}</p>}
              <small>{formatDisplayDate(post.published_at)} - Magic Initiative Rwanda</small>
            </div>
          </Link>
        </article>
      ))}
    </section>
  );
}
