"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArticleBody, normalizeArticleBlocks } from "@/app/components/article-body";
import { uploadImageToBucket } from "@/lib/client-image-upload";
import {
  createSlug,
  getMagicData,
  getNewsPostById,
  getNewsPostsForEditor,
  insertNewsPost,
  updateNewsPost,
  updateNewsPostLinks,
  type ArticleBlock,
  type Match,
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
  previous_news_id: string;
  next_news_id: string;
  is_published: boolean;
};

const emptyForm: FormState = {
  title: "",
  slug: "",
  category: "Club",
  excerpt: "",
  image_url: "",
  previous_news_id: "",
  next_news_id: "",
  is_published: true,
};

export function NewsEditor({ postId }: NewsEditorProps) {
  const [session, setSession] = useState<PortalSession | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [blocks, setBlocks] = useState<ArticleBlock[]>([{ type: "paragraph", text: "" }]);
  const [availableNews, setAvailableNews] = useState<NewsPost[]>([]);
  const [availableMatches, setAvailableMatches] = useState<Match[]>([]);
  const textareas = useRef<Record<string, HTMLTextAreaElement | null>>({});
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

        const [allNews, matchData] = await Promise.all([
          getNewsPostsForEditor(freshSession.access_token),
          getMagicData(freshSession.access_token, true),
        ]);
        if (active) setAvailableNews(allNews.filter((candidate) => candidate.id !== postId));
        if (active) setAvailableMatches(matchData.matches);

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
      previous_news_id: post.previous_news_id || "",
      next_news_id: post.next_news_id || "",
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
        ? { type: "paragraph", text: "", align: "left", weight: "normal", size: "medium" }
        : type === "list"
          ? { type: "list", ordered: false, items: [{ text: "", related_match_ids: [] }] }
          : { type: "image", url: "", align: "left", width: "medium", caption: null },
    ]);
  }

  function updateBlock(index: number, patch: Partial<ArticleBlock>) {
    setBlocks((current) => current.map((block, blockIndex) => (
      blockIndex === index ? ({ ...block, ...patch } as ArticleBlock) : block
    )));
  }

  function addRelatedMatch(index: number, matchId: string) {
    if (!matchId) return;
    const block = blocks[index];
    if (block?.type !== "paragraph" || block.related_match_ids?.includes(matchId)) return;
    updateBlock(index, { related_match_ids: [...(block.related_match_ids || []), matchId] });
  }

  function removeRelatedMatch(index: number, matchId: string) {
    const block = blocks[index];
    if (block?.type !== "paragraph") return;
    const token = `[[match:${matchId}]]`;
    const tokenIndex = block.text.indexOf(token);
    updateBlock(index, {
      text: tokenIndex >= 0 ? `${block.text.slice(0, tokenIndex)}${block.text.slice(tokenIndex + token.length)}` : block.text,
      related_match_ids: (block.related_match_ids || []).filter((id) => id !== matchId),
    });
  }

  function editorText(text: string) {
    return text.replace(/\[\[match:([^\]]+)\]\]/g, (_, matchId: string) => {
      const match = availableMatches.find((candidate) => candidate.id === matchId);
      return match ? `[${match.opponent_name || "Match"} — ${match.match_date}]` : "[View Match]";
    });
  }

  function storedText(text: string, relatedMatchIds: string[]) {
    let nextText = text;
    relatedMatchIds.forEach((matchId) => {
      const match = availableMatches.find((candidate) => candidate.id === matchId);
      const title = match ? `[${match.opponent_name || "Match"} — ${match.match_date}]` : "[View Match]";
      nextText = nextText.replace(title, `[[match:${matchId}]]`);
    });
    return nextText;
  }

  function insertMatchToken(index: number, matchId: string, itemIndex?: number) {
    if (!matchId) return;
    const block = blocks[index];
    const key = itemIndex === undefined ? `paragraph-${index}` : `list-${index}-${itemIndex}`;
    const textarea = textareas.current[key];
    const match = availableMatches.find((candidate) => candidate.id === matchId);
    const label = match ? `[${match.opponent_name || "Match"} — ${match.match_date}]` : "[View Match]";

    if (itemIndex === undefined && block?.type === "paragraph") {
      const visibleText = editorText(block.text);
      const start = textarea?.selectionStart ?? visibleText.length;
      const nextVisibleText = `${visibleText.slice(0, start)}${label}${visibleText.slice(start)}`;
      updateBlock(index, { text: storedText(nextVisibleText, [...(block.related_match_ids || []), matchId]), related_match_ids: [...(block.related_match_ids || []), matchId] });
    } else if (itemIndex !== undefined && block?.type === "list") {
      const item = block.items[itemIndex];
      const text = typeof item === "string" ? item : item.text;
      const related_match_ids = typeof item === "string" ? [] : (item.related_match_ids || []);
      const visibleText = editorText(text);
      const start = textarea?.selectionStart ?? visibleText.length;
      const items = block.items.map((current, currentIndex) => currentIndex === itemIndex
        ? { text: storedText(`${visibleText.slice(0, start)}${label}${visibleText.slice(start)}`, [...related_match_ids, matchId]), related_match_ids: [...related_match_ids, matchId] }
        : current);
      updateBlock(index, { items });
    }
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
        previous_news_id: form.previous_news_id || null,
        next_news_id: form.next_news_id || null,
        content: cleanedBlocks,
        published_at: publishedAt || new Date().toISOString(),
        is_published: form.is_published,
      };
      const oldPost = isEditing && postId
        ? await getNewsPostById(postId, session.access_token)
        : null;

      const saved = isEditing && postId
        ? await updateNewsPost(postId, payload, session.access_token)
        : await insertNewsPost(payload, session.access_token);
      const savedPost = saved?.[0];

      if (savedPost) {
        const currentId = savedPost.id;
        const previousStory = form.previous_news_id
          ? await getNewsPostById(form.previous_news_id, session.access_token)
          : null;
        const nextStory = form.next_news_id
          ? await getNewsPostById(form.next_news_id, session.access_token)
          : null;

        if (previousStory && previousStory.next_news_id !== currentId) {
          await updateNewsPostLinks(previousStory.id, { next_news_id: currentId }, session.access_token);
        }
        if (nextStory && nextStory.previous_news_id !== currentId) {
          await updateNewsPostLinks(nextStory.id, { previous_news_id: currentId }, session.access_token);
        }

        if (oldPost?.previous_news_id && oldPost.previous_news_id !== form.previous_news_id) {
          const oldPreviousStory = await getNewsPostById(oldPost.previous_news_id, session.access_token);
          if (oldPreviousStory?.next_news_id === currentId) {
            await updateNewsPostLinks(oldPreviousStory.id, { next_news_id: null }, session.access_token);
          }
        }
        if (oldPost?.next_news_id && oldPost.next_news_id !== form.next_news_id) {
          const oldNextStory = await getNewsPostById(oldPost.next_news_id, session.access_token);
          if (oldNextStory?.previous_news_id === currentId) {
            await updateNewsPostLinks(oldNextStory.id, { previous_news_id: null }, session.access_token);
          }
        }

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
              <label className={styles.field}>
                <span>Previous news <small>(optional)</small></span>
                <select value={form.previous_news_id} onChange={(event) => updateForm("previous_news_id", event.target.value)}>
                  <option value="">None</option>
                  {availableNews.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}
                </select>
              </label>
              <label className={styles.field}>
                <span>Next news <small>(optional)</small></span>
                <select value={form.next_news_id} onChange={(event) => updateForm("next_news_id", event.target.value)}>
                  <option value="">None</option>
                  {availableNews.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}
                </select>
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
              <button className={styles.secondaryButton} type="button" onClick={() => addBlock("list")}>
                + Add list
              </button>
            </div>

            {blocks.map((block, index) => (
              <div className={styles.block} key={`${block.type}-${index}`}>
                <div className={styles.blockHead}>
                  <span className={styles.blockLabel}>{block.type === "paragraph" ? "Paragraph" : block.type === "image" ? "Image" : "List"} {index + 1}</span>
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
                  <>
                    <div className={styles.formatRow}>
                      <label className={styles.inlineField}>
                        <span>Align</span>
                        <select value={block.align || "left"} onChange={(event) => updateBlock(index, { align: event.target.value as "left" | "center" | "right" })}>
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                        </select>
                      </label>
                      <label className={styles.inlineField}>
                        <span>Size</span>
                        <select value={block.size || "medium"} onChange={(event) => updateBlock(index, { size: event.target.value as "small" | "medium" | "large" })}>
                          <option value="small">Small</option>
                          <option value="medium">Medium</option>
                          <option value="large">Large</option>
                        </select>
                      </label>
                      <label className={styles.boldToggle}>
                        <input type="checkbox" checked={block.weight === "bold"} onChange={(event) => updateBlock(index, { weight: event.target.checked ? "bold" : "normal" })} />
                        Bold
                      </label>
                      <label className={styles.boldToggle}>
                        <input type="checkbox" checked={block.clear === true} onChange={(event) => updateBlock(index, { clear: event.target.checked })} />
                        Start below images
                      </label>
                    </div>
                    <div className={styles.relatedMatches}>
                      <label className={styles.inlineField}>
                        <span>Add related match</span>
                        <select value="" onChange={(event) => insertMatchToken(index, event.target.value)}>
                          <option value="">Choose a match...</option>
                          {availableMatches.map((match) => <option key={match.id} value={match.id}>{match.opponent_name || "Match"} — {match.match_date}</option>)}
                        </select>
                      </label>
                      <div className={styles.matchChips}>
                        {(block.related_match_ids || []).map((matchId, matchIndex) => {
                          const match = availableMatches.find((candidate) => candidate.id === matchId);
                          return <span className={styles.matchChip} key={`${matchId}-${matchIndex}`}>Inline: {match?.opponent_name || "Related match"}<button type="button" aria-label="Remove related match" onClick={() => removeRelatedMatch(index, matchId)}>×</button></span>;
                        })}
                      </div>
                    </div>
                    <textarea
                      rows={5}
                      value={editorText(block.text)}
                      ref={(element) => { textareas.current[`paragraph-${index}`] = element; }}
                      onChange={(event) => updateBlock(index, { text: storedText(event.target.value, block.related_match_ids || []) })}
                    />
                  </>
                ) : block.type === "list" ? (
                  <div className={styles.listEditor}>
                    <label className={styles.fullField}>
                      <span>List style</span>
                      <select value={block.ordered ? "ordered" : "unordered"} onChange={(event) => updateBlock(index, { ordered: event.target.value === "ordered" })}>
                        <option value="unordered">Unordered — bullet points</option>
                        <option value="ordered">Ordered — steps</option>
                      </select>
                    </label>
                    {block.items.map((item, itemIndex) => {
                      const text = typeof item === "string" ? item : item.text;
                      const relatedIds = typeof item === "string" ? [] : (item.related_match_ids || []);
                      return <div className={styles.listItemEditor} key={`list-item-${itemIndex}`}>
                        <span className={styles.blockLabel}>Item {itemIndex + 1}</span>
                        <textarea
                          rows={2}
                          value={editorText(text)}
                          ref={(element) => { textareas.current[`list-${index}-${itemIndex}`] = element; }}
                          onChange={(event) => updateBlock(index, { items: block.items.map((current, currentIndex) => currentIndex === itemIndex ? { text: storedText(event.target.value, relatedIds), related_match_ids: relatedIds } : current) })}
                        />
                        <label className={styles.inlineField}>
                          <span>Add related match</span>
                          <select value="" onChange={(event) => insertMatchToken(index, event.target.value, itemIndex)}>
                            <option value="">Choose a match...</option>
                            {availableMatches.map((match) => <option key={match.id} value={match.id}>{match.opponent_name || "Match"} — {match.match_date}</option>)}
                          </select>
                        </label>
                      </div>;
                    })}
                  </div>
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
                      <label className={styles.fullField}>
                        <span>Image width</span>
                        <select value={block.width || "medium"} onChange={(event) => updateBlock(index, { width: event.target.value as "small" | "medium" | "large" })}>
                          <option value="small">Small — more text beside it</option>
                          <option value="medium">Medium</option>
                          <option value="large">Large</option>
                        </select>
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
                        <button
                          className={`${styles.alignButton} ${block.align === "full" ? styles.alignButtonActive : ""}`}
                          type="button"
                          onClick={() => updateBlock(index, { align: "full" })}
                        >
                          Full width
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className={styles.addRow}>
              <button className={styles.secondaryButton} type="button" onClick={() => addBlock("paragraph")}>
                + Add paragraph
              </button>
              <button className={styles.secondaryButton} type="button" onClick={() => addBlock("image")}>
                + Add image
              </button>
              <button className={styles.secondaryButton} type="button" onClick={() => addBlock("list")}>
                + Add list
              </button>
            </div>

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
              <ArticleBody blocks={previewBlocks} fallbackText={form.excerpt} matches={availableMatches} />
            </article>
          </aside>
        </div>
      </div>
    </main>
  );
}
