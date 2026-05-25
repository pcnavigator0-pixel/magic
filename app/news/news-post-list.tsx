"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { NewsImageCarousel } from "@/app/components/news-image-carousel";
import type { NewsPost } from "@/lib/magic-data";

type NewsPostListProps = {
  posts: NewsPost[];
};

export function NewsPostList({ posts }: NewsPostListProps) {
  const [selectedPost, setSelectedPost] = useState<NewsPost | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!selectedPost) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedPost(null);
    };

    document.body.classList.add("modal-open");
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedPost]);

  return (
    <>
      <section className="public-grid three-columns">
        {posts.map((post) => (
          <article
            className="public-card news-public-card news-card-button"
            key={post.id}
            role="button"
            tabIndex={0}
            onClick={() => setSelectedPost(post)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setSelectedPost(post);
              }
            }}
          >
            <NewsImageCarousel imageValue={post.image_url} alt={post.title} />
            <span>{post.category}</span>
            <h2>{post.title}</h2>
            {post.excerpt && <p>{post.excerpt}</p>}
            <small>{formatDisplayDate(post.published_at)} - MAGIC BBC</small>
          </article>
        ))}
      </section>

      {isMounted && selectedPost
        ? createPortal(
            <NewsModal post={selectedPost} onClose={() => setSelectedPost(null)} />,
            document.body,
          )
        : null}
    </>
  );
}

function NewsModal({ post, onClose }: { post: NewsPost; onClose: () => void }) {
  const paragraphs = getArticleParagraphs(post);

  return (
    <div className="news-modal-layer" role="presentation" onMouseDown={onClose}>
      <article
        className="news-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="news-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="news-modal-close" type="button" aria-label="Close news details" onClick={onClose}>
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>

        <NewsImageCarousel
          imageValue={post.image_url}
          alt={post.title}
          className="news-modal-carousel"
          placeholderClassName="news-image-placeholder news-image-placeholder-large"
        />

        <div className="news-modal-content">
          <div className="news-modal-meta">
            <span>{post.category}</span>
            <small>{formatDisplayDate(post.published_at)} - MAGIC BBC</small>
          </div>
          <h2 id="news-modal-title">{post.title}</h2>
          {post.excerpt && <p className="news-modal-excerpt">{post.excerpt}</p>}

          <div className="news-modal-body">
            {paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}

function getArticleParagraphs(post: NewsPost) {
  const source = post.content || post.excerpt || "Full story details will be added soon.";

  return source
    .split(/\n{2,}|\r\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
