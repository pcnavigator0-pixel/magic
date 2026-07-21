"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { ArticleBody, normalizeArticleBlocks } from "@/app/components/article-body";
import { uploadImageToBucket } from "@/lib/client-image-upload";
import {
  createSlug,
  getNewsPostById,
  insertNewsPost,
  updateNewsPost,
  type ArticleBlock,
  type NewsPost,
} from "@/lib/magic-data";
import { getFreshPortalSession, type PortalSession } from "@/lib/portal-auth";
import styles from "./news-editor.module.css";

type NewsEditorProps = {
  postId?: string;
};

type FormState = {
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  image_url: string;
  is_published: boolean;
};

const emptyForm: FormState = {
  title: "",
  slug: "",
  category: "Club",
  excerpt: "",
  image_url: "",
  is_published: true,
};

export function NewsEditor({ postId }: NewsEditorProps) {
  const [session, setSession] = useState<PortalSession | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [blocks, setBlocks] = useState<ArticleBlock[]>([{ type: "paragraph", text: "" }]);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(Boolean(postId));
  const [status, setStatus] = useState("Checking coach access...");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const isEditing = Boolean(postId);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const freshSession = await getFreshPortalSession();

        if (!freshSession) {
          window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
          return;
        }

        if (freshSession.profile.role !== "coach") {
          window.location.href = "/player-dashboard";
          return;
        }

        if (!active) return;
        setSession(freshSession);

        if (postId) {
          const post = await getNewsPostById(postId, freshSession.access_token);
          if (!post) throw new Error("This news post could not be found.");
          applyPost(post);
          setStatus("");
        } else {
          setStatus("");
        }
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Unable to load the news editor.";
        if (active) {
          setError(message);
          setStatus("");
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [postId]);

  const previewBlocks = useMemo(() => normalizeArticleBlocks(blocks, form.excerpt), [blocks, form.excerpt]);

  function applyPost(post: NewsPost) {
    setForm({
      title: post.title,
      slug: post.slug,
      category: post.category,
      excerpt: post.excerpt || "",
      image_url: post.image_url || "",
      is_published: post.is_published,
    });
    setBlocks(normalizeArticleBlocks(post.content, post.excerpt));
    setPublishedAt(post.published_at);
  }

  function updateForm(key: keyof FormState, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleTitleChange(value: string) {
    setForm((current) => ({
      ...current,
      title: value,
      slug: slugTouched ? current.slug : createSlug(value),
    }));
  }

  function addBlock(type: ArticleBlock["type"]) {
    setBlocks((current) => [
      ...current,
      type === "paragraph"
        ? { type: "paragraph", text: "" }
        : { type: "image", url: "", align: "left", caption: null },
    ]);
  }

  function updateBlock(index: number, patch: Partial<ArticleBlock>) {
    setBlocks((current) => current.map((block, blockIndex) => (
      blockIndex === index ? ({ ...block, ...patch } as ArticleBlock) : block
    )));
  }

  function moveBlock(index: number, direction: -1 | 1) {
    setBlocks((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function removeBlock(index: number) {
    setBlocks((current) => current.filter((_, blockIndex) => blockIndex !== index));
  }

  async function uploadCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    if (!file || !session) return;
    setError("");
    const url = await uploadImageToBucket({
      fileValue: file,
      bucket: "news-images",
      folder: "covers",
      accessToken: session.access_token,
    });
    updateForm("image_url", url);
  }

  async function uploadBlockImage(index: number, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    if (!file || !session) return;
    setError("");
    const url = await uploadImageToBucket({
      fileValue: file,
      bucket: "news-images",
      folder: "blocks",
      accessToken: session.access_token,
    });
    updateBlock(index, { url } as Partial<ArticleBlock>);
  }

  async function savePost() {
    if (!session || isSaving) return;

    const slug = createSlug(form.slug || form.title);
    const cleanedBlocks = normalizeArticleBlocks(blocks, form.excerpt);

    if (!form.title.trim()) {
      setError("Add a title before saving.");
      return;
    }

    if (!slug) {
      setError("Add a valid slug before saving.");
      return;
    }

    setError("");
    setIsSaving(true);

    try {
      const payload = {
        title: form.title.trim(),
        slug,
        category: form.category.trim() || "Club",
        excerpt: form.excerpt.trim() || null,
        image_url: form.image_url.trim() || null,
        content: cleanedBlocks,
        published_at: publishedAt || new Date().toISOString(),
        is_published: form.is_published,
      };

      const saved = isEditing && postId
        ? await updateNewsPost(postId, payload, session.access_token)
        : await insertNewsPost(payload, session.access_token);
      const savedPost = saved?.[0];

      if (savedPost) {
        window.location.href = `/portal/news/${savedPost.id}/edit`;
        return;
      }

      setStatus("Saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save this story.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <span>Coach portal</span>
            <h1>{isEditing ? "Edit news story" : "Write a news story"}</h1>
            <p>Add paragraphs and images in the exact order the public article should read.</p>
          </div>
          <Link className={styles.backLink} href="/coach-dashboard">
            <i className="fa-solid fa-arrow-left" aria-hidden="true" />
            Dashboard
          </Link>
        </header>

        {status && <p className={styles.status}>{status}</p>}
        {error && <p className={`${styles.status} ${styles.error}`}>{error}</p>}

        <div className={styles.layout}>
          <section className={styles.panel} aria-label="News editor">
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Title</span>
                <input value={form.title} onChange={(event) => handleTitleChange(event.target.value)} required />
              </label>
              <label className={styles.field}>
                <span>Slug</span>
                <input
                  value={form.slug}
                  onChange={(event) => {
                    setSlugTouched(true);
                    updateForm("slug", createSlug(event.target.value));
                  }}
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Category</span>
                <input value={form.category} onChange={(event) => updateForm("category", event.target.value)} />
              </label>
              <label className={styles.field}>
                <span>Cover image URL</span>
                <input value={form.image_url} onChange={(event) => updateForm("image_url", event.target.value)} />
              </label>
              <label className={styles.field}>
                <span>Upload cover image</span>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={uploadCover} />
              </label>
              <label className={styles.checkField}>
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={(event) => updateForm("is_published", event.target.checked)}
                />
                Published
              </label>
              <label className={styles.fullField}>
                <span>Excerpt</span>
                <textarea rows={3} value={form.excerpt} onChange={(event) => updateForm("excerpt", event.target.value)} />
              </label>
            </div>

            <span className={styles.panelTitle}>Story blocks</span>
            <div className={styles.addRow}>
              <button className={styles.secondaryButton} type="button" onClick={() => addBlock("paragraph")}>
                + Add paragraph
              </button>
              <button className={styles.secondaryButton} type="button" onClick={() => addBlock("image")}>
                + Add image
              </button>
            </div>

            {blocks.map((block, index) => (
              <div className={styles.block} key={`${block.type}-${index}`}>
                <div className={styles.blockHead}>
                  <span className={styles.blockLabel}>{block.type === "paragraph" ? "Paragraph" : "Image"} {index + 1}</span>
                  <div className={styles.blockActions}>
                    <button className={styles.iconButton} type="button" aria-label="Move block up" onClick={() => moveBlock(index, -1)}>
                      <i className="fa-solid fa-arrow-up" aria-hidden="true" />
                    </button>
                    <button className={styles.iconButton} type="button" aria-label="Move block down" onClick={() => moveBlock(index, 1)}>
                      <i className="fa-solid fa-arrow-down" aria-hidden="true" />
                    </button>
                    <button className={styles.dangerButton} type="button" onClick={() => removeBlock(index)}>Remove</button>
                  </div>
                </div>

                {block.type === "paragraph" ? (
                  <textarea
                    rows={5}
                    value={block.text}
                    onChange={(event) => updateBlock(index, { text: event.target.value })}
                  />
                ) : (
                  <div className={styles.imageGrid}>
                    {block.url ? <img className={styles.thumb} src={block.url} alt={block.caption || ""} /> : <div className={styles.thumb} />}
                    <div>
                      <label className={styles.fullField}>
                        <span>Image URL</span>
                        <input value={block.url} onChange={(event) => updateBlock(index, { url: event.target.value })} />
                      </label>
                      <label className={styles.fullField}>
                        <span>Upload image</span>
                        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => uploadBlockImage(index, event)} />
                      </label>
                      <label className={styles.fullField}>
                        <span>Caption</span>
                        <input value={block.caption || ""} onChange={(event) => updateBlock(index, { caption: event.target.value || null })} />
                      </label>
                      <div className={styles.alignRow} aria-label="Image alignment">
                        <button
                          className={`${styles.alignButton} ${block.align === "left" ? styles.alignButtonActive : ""}`}
                          type="button"
                          onClick={() => updateBlock(index, { align: "left" })}
                        >
                          Left
                        </button>
                        <button
                          className={`${styles.alignButton} ${block.align === "right" ? styles.alignButtonActive : ""}`}
                          type="button"
                          onClick={() => updateBlock(index, { align: "right" })}
                        >
                          Right
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className={styles.actionBar}>
              <Link className={styles.secondaryButton} href="/coach-dashboard">Cancel</Link>
              <button className={styles.primaryButton} type="button" disabled={isSaving || !session} onClick={savePost}>
                {isSaving ? "Saving..." : isEditing ? "Update News" : "Publish News"}
              </button>
            </div>
          </section>

          <aside className={`${styles.panel} ${styles.preview}`} aria-label="Live preview">
            <span className={styles.panelTitle}>Live preview</span>
            <article className={styles.previewArticle}>
              <header className={styles.previewMeta}>
                <span>{form.category || "Club"}</span>
                <h2>{form.title || "Untitled story"}</h2>
                {form.excerpt && <p>{form.excerpt}</p>}
              </header>
              {form.image_url ? (
                <img className={styles.previewCover} src={form.image_url} alt={form.title || "News cover"} />
              ) : (
                <div className={styles.previewPlaceholder}>Magic Initiative Rwanda</div>
              )}
              <ArticleBody blocks={previewBlocks} fallbackText={form.excerpt} />
            </article>
          </aside>
        </div>
      </div>
    </main>
  );
}
