"use client";

import { FormEvent, useEffect, useState } from "react";
import { addNewsComment, formatCompactCount, getNewsComments, reactToNews, type NewsComment } from "@/lib/magic-data";

type NewsEngagementProps = {
  postId: string;
  title: string;
  viewCount: number;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  slug?: string;
  compact?: boolean;
};

export function NewsEngagement({ postId, title, viewCount, likeCount, dislikeCount, commentCount, slug, compact = false }: NewsEngagementProps) {
  const [likes, setLikes] = useState(likeCount);
  const [dislikes, setDislikes] = useState(dislikeCount);
  const [commentsCount, setCommentsCount] = useState(commentCount);
  const [comments, setComments] = useState<NewsComment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [authorName, setAuthorName] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [message, setMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [visitorId] = useState(() => {
    if (typeof window === "undefined") return "server-rendered-visitor";
    try {
      const existing = window.localStorage.getItem("magic.news.visitor-id");
      if (existing) return existing;
      const created = typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem("magic.news.visitor-id", created);
      return created;
    } catch {
      return `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  });
  const [voted, setVoted] = useState<"like" | "dislike" | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const storedVote = window.localStorage.getItem(`magic.news.vote.${postId}`);
      return storedVote === "like" || storedVote === "dislike" ? storedVote : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!showComments) return;
    getNewsComments(postId).then(setComments);
  }, [postId, showComments]);

  async function react(reaction: "like" | "dislike") {
    if (voted || isWorking) return;
    setIsWorking(true);
    setMessage("");
    const result = await reactToNews(postId, reaction, visitorId);
    if (!result) {
      setMessage("We could not save your reaction. Please try again.");
    } else {
      setLikes(result.like_count);
      setDislikes(result.dislike_count);
      setVoted(reaction);
      try {
        window.localStorage.setItem(`magic.news.vote.${postId}`, reaction);
      } catch {
        // The server has recorded the reaction even if browser storage is unavailable.
      }
    }
    setIsWorking(false);
  }

  async function share() {
    const url = slug ? `${window.location.origin}/news/${encodeURIComponent(slug)}` : window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        setMessage("Thanks for sharing this story.");
      } else {
        await navigator.clipboard.writeText(url);
        setMessage("Story link copied to your clipboard.");
      }
    } catch {
      setMessage("Sharing was cancelled.");
    }
  }

  function download() {
    if (compact && slug) {
      window.open(`/news/${encodeURIComponent(slug)}?print=1`, "_blank", "noopener,noreferrer");
      return;
    }
    setMessage("Choose Save as PDF in the print window to download the complete story.");
    window.setTimeout(() => window.print(), 0);
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commentBody.trim() || isWorking) return;
    setIsWorking(true);
    setMessage("");
    const displayName = authorName.trim() || "Guest";
    const result = await addNewsComment(postId, displayName, commentBody);
    if (!result) {
      setMessage("We could not post your comment. Please try again.");
    } else {
      setCommentsCount(result.comment_count);
      setComments((current) => [{ id: `local-${Date.now()}`, news_post_id: postId, author_name: displayName, body: commentBody.trim(), created_at: new Date().toISOString() }, ...current]);
      setAuthorName("");
      setCommentBody("");
      setShowComments(true);
      setMessage("Comment posted.");
    }
    setIsWorking(false);
  }

  return (
    <section className={compact ? "news-engagement news-engagement-compact" : "news-engagement"} aria-label="News engagement">
      <div className="news-engagement-row">
        <span className="news-engagement-stat"><i className="fa-solid fa-eye" aria-hidden="true" /> {formatCompactCount(viewCount)}</span>
        <button type="button" className={voted === "like" ? "news-engagement-button active" : "news-engagement-button"} onClick={() => react("like")} disabled={Boolean(voted) || isWorking} aria-label="Like this story">
          <i className="fa-solid fa-thumbs-up" aria-hidden="true" /> {formatCompactCount(likes)}
        </button>
        <button type="button" className={voted === "dislike" ? "news-engagement-button active" : "news-engagement-button"} onClick={() => react("dislike")} disabled={Boolean(voted) || isWorking} aria-label="Dislike this story">
          <i className="fa-solid fa-thumbs-down" aria-hidden="true" /> {formatCompactCount(dislikes)}
        </button>
        <button type="button" className="news-engagement-button" onClick={share} aria-label="Share this story">
          <i className="fa-solid fa-share-nodes" aria-hidden="true" /> Share
        </button>
        {!compact && <button type="button" className="news-engagement-button" onClick={() => setShowComments((current) => !current)} aria-expanded={showComments} aria-label="Show comments">
          <i className="fa-solid fa-comment" aria-hidden="true" /> {formatCompactCount(commentsCount)}
        </button>}
        {compact && <a className="news-engagement-button" href={`/news/${encodeURIComponent(slug || "")}`} onClick={(event) => event.stopPropagation()} aria-label="Open comments for this story">
          <i className="fa-solid fa-comment" aria-hidden="true" /> {formatCompactCount(commentsCount)}
        </a>}
        <button type="button" className="news-engagement-button" onClick={download} aria-label="Download this story">
          <i className="fa-solid fa-file-pdf" aria-hidden="true" /> {compact ? "PDF" : "Download PDF"}
        </button>
      </div>
      {message && <p className="news-engagement-message" role="status">{message}</p>}
      {showComments && (
        <div className="news-comments-panel">
          <form className="news-comment-form" onSubmit={submitComment}>
            <input value={authorName} onChange={(event) => setAuthorName(event.target.value)} maxLength={80} placeholder="Your name (optional)" aria-label="Your name (optional)" />
            <textarea value={commentBody} onChange={(event) => setCommentBody(event.target.value)} maxLength={1000} placeholder="Write a comment..." aria-label="Write a comment" rows={3} required />
            <button type="submit" disabled={isWorking}>Post comment</button>
          </form>
          <div className="news-comments-list">
            {comments.map((comment) => <article className="news-comment" key={comment.id}><strong>{comment.author_name}</strong><p>{comment.body}</p></article>)}
            {!comments.length && <p className="news-comments-empty">Be the first to comment.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
