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

type RichTextSurfaceProps = {
  html: string;
  label?: string;
  onChange: (html: string) => void;
  onFocus: () => void;
  register: (element: HTMLDivElement | null) => void;
};

function RichTextSurface({ html, label, onChange, onFocus, register }: RichTextSurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (surfaceRef.current && surfaceRef.current.innerHTML !== html) {
      surfaceRef.current.innerHTML = html;
    }
  }, [html]);

  return (
    <div
      className={styles.richTextSurface}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={label}
      ref={(element) => {
        surfaceRef.current = element;
        register(element);
      }}
      onFocus={onFocus}
      onInput={(event) => onChange(event.currentTarget.innerHTML)}
    />
  );
}

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
  is_published: false,
};

export function NewsEditor({ postId }: NewsEditorProps) {
  const [session, setSession] = useState<PortalSession | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [blocks, setBlocks] = useState<ArticleBlock[]>([{ type: "paragraph", text: "" }]);
  const [availableNews, setAvailableNews] = useState<NewsPost[]>([]);
  const [availableMatches, setAvailableMatches] = useState<Match[]>([]);
  const textareas = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const editableRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [activeEditable, setActiveEditable] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(Boolean(postId));
  const [status, setStatus] = useState("Checking coach access...");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const isEditing = Boolean(postId);

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
    setHasUnsavedChanges(false);
  }

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

  function updateForm(key: keyof FormState, value: string | boolean) {
    setHasUnsavedChanges(true);
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleTitleChange(value: string) {
    setHasUnsavedChanges(true);
    setForm((current) => ({
      ...current,
      title: value,
      slug: slugTouched ? current.slug : createSlug(value),
    }));
  }

  function addBlock(type: ArticleBlock["type"]) {
    setHasUnsavedChanges(true);
    setBlocks((current) => [
      ...current,
      type === "paragraph"
        ? { type: "paragraph", text: "", align: "left", size: "medium" }
        : type === "heading"
          ? { type: "heading", text: "", level: 2 }
          : type === "quote" || type === "pullquote"
            ? { type, text: "", citation: null }
            : type === "list"
              ? { type: "list", ordered: false, items: [{ text: "", related_match_ids: [] }] }
              : type === "table"
                ? { type: "table", headers: ["Column 1", "Column 2"], rows: [["", ""]] }
                : type === "embed"
                  ? { type: "embed", url: "", provider: "youtube", caption: null }
                  : { type: "image", url: "", align: "left", width: "medium", caption: null, crop: { zoom: 1, x: 50, y: 50 } },
    ]);
  }

  function updateBlock(index: number, patch: Partial<ArticleBlock>) {
    setHasUnsavedChanges(true);
    setBlocks((current) => current.map((block, blockIndex) => (
      blockIndex === index ? ({ ...block, ...patch } as ArticleBlock) : block
    )));
  }

  function updateRichText(index: number, html: string) {
    updateBlock(index, { text: html } as Partial<ArticleBlock>);
  }

  function runFormat(command: string, value?: string) {
    if (!activeEditable) return;
    editableRefs.current[activeEditable]?.focus();
    document.execCommand(command, false, value);
    const [kind, indexValue] = activeEditable.split(":");
    if (kind === "block") {
      const index = Number(indexValue);
      const element = editableRefs.current[activeEditable];
      if (element) updateRichText(index, element.innerHTML);
    }
  }

  function addLink() {
    const url = window.prompt("Enter the link URL", "https://");
    if (!url) return;

    const selectedText = window.getSelection()?.toString() || "";
    const label = window.prompt("Text to show for this link. Keep the URL to show the full address, or type a label.", selectedText || url);
    if (label === null) return;

    runFormat("insertHTML", `<a href="${escapeHtmlAttribute(url)}">${escapeHtmlText(label || url)}</a>`);
  }

  function chooseTextColor() {
    const color = window.prompt("Enter a color name or hex value", "#e64a19");
    if (color) runFormat("foreColor", color);
  }

  function escapeHtmlAttribute(value: string) {
    return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function escapeHtmlText(value: string) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
    setHasUnsavedChanges(true);
    setBlocks((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function removeBlock(index: number) {
    setHasUnsavedChanges(true);
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

  async function savePost(publishOverride?: boolean) {
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
        is_published: publishOverride ?? form.is_published,
      };
      const oldPost = isEditing && postId
        ? await getNewsPostById(postId, session.access_token)
        : null;

      const saved = isEditing && postId
        ? await updateNewsPost(postId, payload, session.access_token)
        : await insertNewsPost(payload, session.access_token);
      const savedPost = saved?.[0];

      if (savedPost) {
        setHasUnsavedChanges(false);
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
      setHasUnsavedChanges(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save this story.");
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;

    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasUnsavedChanges]);

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

        <nav className={styles.ribbon} aria-label="Story editing toolbar">
          <div className={styles.ribbonGroup}>
            <span className={styles.ribbonLabel}>Insert</span>
            <div className={styles.ribbonButtons}>
              <button className={styles.ribbonButton} type="button" onClick={() => addBlock("paragraph")} title="Add a paragraph">
                <i className="fa-solid fa-paragraph" aria-hidden="true" />
                <span>Paragraph</span>
              </button>
              <button className={styles.ribbonButton} type="button" onClick={() => addBlock("image")} title="Add an image">
                <i className="fa-regular fa-image" aria-hidden="true" />
                <span>Picture</span>
              </button>
              <button className={styles.ribbonButton} type="button" onClick={() => addBlock("list")} title="Add a list">
                <i className="fa-solid fa-list" aria-hidden="true" />
                <span>List</span>
              </button>
              <button className={styles.ribbonButton} type="button" onClick={() => addBlock("heading")} title="Add a heading">
                <i className="fa-solid fa-heading" aria-hidden="true" />
                <span>Heading</span>
              </button>
              <button className={styles.ribbonButton} type="button" onClick={() => addBlock("quote")} title="Add a quote">
                <i className="fa-solid fa-quote-left" aria-hidden="true" />
                <span>Quote</span>
              </button>
              <button className={styles.ribbonButton} type="button" onClick={() => addBlock("pullquote")} title="Add a pull quote">
                <i className="fa-solid fa-quote-right" aria-hidden="true" />
                <span>Pull quote</span>
              </button>
              <button className={styles.ribbonButton} type="button" onClick={() => addBlock("table")} title="Add a table">
                <i className="fa-solid fa-table" aria-hidden="true" />
                <span>Table</span>
              </button>
              <button className={styles.ribbonButton} type="button" onClick={() => addBlock("embed")} title="Embed video or social content">
                <i className="fa-solid fa-film" aria-hidden="true" />
                <span>Embed</span>
              </button>
            </div>
          </div>
          <div className={styles.ribbonGroup}>
            <span className={styles.ribbonLabel}>Format selection</span>
            <div className={styles.ribbonButtons}>
              <button className={styles.ribbonButton} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runFormat("bold")} title="Bold selected text"><strong>B</strong><span>Bold</span></button>
              <button className={styles.ribbonButton} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runFormat("italic")} title="Italicize selected text"><em>I</em><span>Italic</span></button>
              <button className={styles.ribbonButton} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runFormat("underline")} title="Underline selected text"><u>U</u><span>Underline</span></button>
              <button className={styles.ribbonButton} type="button" onMouseDown={(event) => event.preventDefault()} onClick={addLink} title="Add a hyperlink"><i className="fa-solid fa-link" aria-hidden="true" /><span>Link</span></button>
              <button className={styles.ribbonButton} type="button" onMouseDown={(event) => event.preventDefault()} onClick={chooseTextColor} title="Change selected text color"><i className="fa-solid fa-palette" aria-hidden="true" /><span>Color</span></button>
            </div>
          </div>
          <div className={styles.ribbonGroup}>
            <span className={styles.ribbonLabel}>Story</span>
            <div className={styles.ribbonButtons}>
              <button className={styles.ribbonButton} type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} title="Edit story details">
                <i className="fa-solid fa-heading" aria-hidden="true" />
                <span>Details</span>
              </button>
              <button className={styles.ribbonButton} type="button" onClick={() => document.querySelector(".news-editor-body")?.scrollIntoView({ behavior: "smooth" })} title="Jump to article body">
                <i className="fa-solid fa-align-left" aria-hidden="true" />
                <span>Body</span>
              </button>
            </div>
          </div>
          <div className={styles.ribbonGroup}>
            <span className={styles.ribbonLabel}>Publish</span>
            <div className={styles.ribbonButtons}>
              <button className={styles.ribbonButton} type="button" disabled={isSaving || !session} onClick={() => savePost(false)} title="Save without publishing">
                <i className="fa-regular fa-floppy-disk" aria-hidden="true" />
                <span>Save draft</span>
              </button>
              <button className={`${styles.ribbonButton} ${styles.ribbonPrimary}`} type="button" disabled={isSaving || !session} onClick={() => savePost(true)} title="Make this story public">
                <i className="fa-solid fa-paper-plane" aria-hidden="true" />
                <span>Publish</span>
              </button>
            </div>
          </div>
          <span className={styles.saveIndicator} aria-live="polite">
            {isSaving ? "Saving…" : hasUnsavedChanges ? "Unsaved changes" : isEditing ? (form.is_published ? "Published" : "Draft saved") : "New draft"}
          </span>
        </nav>

        <div className={styles.layout}>
          <section className={`${styles.panel} news-editor-body`} aria-label="News editor">
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
                  <span className={styles.blockLabel}>{block.type === "paragraph" ? "Paragraph" : block.type === "image" ? "Image" : block.type === "list" ? "List" : block.type === "heading" ? "Heading" : block.type === "quote" ? "Quote" : block.type === "pullquote" ? "Pull quote" : block.type === "table" ? "Table" : "Embed"} {index + 1}</span>
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
                    <RichTextSurface
                      html={editorText(block.text)}
                      label={`Paragraph ${index + 1}`}
                      register={(element) => { editableRefs.current[`block:${index}`] = element; }}
                      onFocus={() => setActiveEditable(`block:${index}`)}
                      onChange={(html) => updateRichText(index, html)}
                    />
                    <small className={styles.editorHint}>Press Enter for a new line. Select words and use the ribbon for formatting.</small>
                  </>
                ) : block.type === "heading" || block.type === "quote" || block.type === "pullquote" ? (
                  <>
                    <label className={styles.fullField}>
                      <span>{block.type === "heading" ? "Heading text" : block.type === "pullquote" ? "Pull quote" : "Quote"}</span>
                      <RichTextSurface
                        html={editorText(block.text)}
                        label={`${block.type} ${index + 1}`}
                        register={(element) => { editableRefs.current[`block:${index}`] = element; }}
                        onFocus={() => setActiveEditable(`block:${index}`)}
                        onChange={(html) => updateRichText(index, html)}
                      />
                    </label>
                    {block.type === "heading" ? (
                      <label className={styles.inlineField}><span>Level</span><select value={block.level} onChange={(event) => updateBlock(index, { level: Number(event.target.value) as 2 | 3 | 4 })}><option value="2">Main heading</option><option value="3">Subheading</option><option value="4">Small heading</option></select></label>
                    ) : (
                      <label className={styles.fullField}><span>Attribution (optional)</span><input value={block.citation || ""} onChange={(event) => updateBlock(index, { citation: event.target.value || null })} /></label>
                    )}
                  </>
                ) : block.type === "table" ? (
                  <div className={styles.tableEditor}>
                    <div className={styles.tableToolbar}><span className={styles.blockLabel}>Table</span><button className={styles.secondaryButton} type="button" onClick={() => updateBlock(index, { headers: [...block.headers, `Column ${block.headers.length + 1}`], rows: block.rows.map((row) => [...row, ""]) })}>+ Column</button><button className={styles.secondaryButton} type="button" onClick={() => updateBlock(index, { rows: [...block.rows, block.headers.map(() => "")] })}>+ Row</button></div>
                    <table className={styles.editTable}><thead><tr>{block.headers.map((header, headerIndex) => <th key={`edit-header-${headerIndex}`}><input value={header} onChange={(event) => updateBlock(index, { headers: block.headers.map((item, current) => current === headerIndex ? event.target.value : item) })} /></th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={`edit-row-${rowIndex}`}>{block.headers.map((_, cellIndex) => <td key={`edit-cell-${rowIndex}-${cellIndex}`}><input value={row[cellIndex] || ""} onChange={(event) => updateBlock(index, { rows: block.rows.map((currentRow, currentRowIndex) => currentRowIndex === rowIndex ? currentRow.map((cell, currentCellIndex) => currentCellIndex === cellIndex ? event.target.value : cell) : currentRow) })} /></td>)}</tr>)}</tbody></table>
                  </div>
                ) : block.type === "embed" ? (
                  <div className={styles.embedEditor}>
                    <label className={styles.fullField}><span>Embed URL</span><input placeholder="YouTube, Vimeo, or social post URL" value={block.url} onChange={(event) => updateBlock(index, { url: event.target.value })} /></label>
                    <label className={styles.inlineField}><span>Provider</span><select value={block.provider} onChange={(event) => updateBlock(index, { provider: event.target.value as "youtube" | "vimeo" | "social" })}><option value="youtube">YouTube</option><option value="vimeo">Vimeo</option><option value="social">Social / external link</option></select></label>
                    <label className={styles.fullField}><span>Caption (optional)</span><input value={block.caption || ""} onChange={(event) => updateBlock(index, { caption: event.target.value || null })} /></label>
                  </div>
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
                ) : block.type === "image" ? (
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
                      <label className={styles.fullField}><span>Crop zoom</span><input type="range" min="1" max="2" step="0.05" value={block.crop?.zoom || 1} onChange={(event) => updateBlock(index, { crop: { zoom: Number(event.target.value), x: block.crop?.x || 50, y: block.crop?.y || 50 } })} /></label>
                      <label className={styles.fullField}><span>Crop focus left / right</span><input type="range" min="0" max="100" value={block.crop?.x || 50} onChange={(event) => updateBlock(index, { crop: { zoom: block.crop?.zoom || 1, x: Number(event.target.value), y: block.crop?.y || 50 } })} /></label>
                      <label className={styles.fullField}><span>Crop focus top / bottom</span><input type="range" min="0" max="100" value={block.crop?.y || 50} onChange={(event) => updateBlock(index, { crop: { zoom: block.crop?.zoom || 1, x: block.crop?.x || 50, y: Number(event.target.value) } })} /></label>
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
                ) : null}
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
              <button className={styles.secondaryButton} type="button" disabled={isSaving || !session} onClick={() => savePost(false)}>
                Save draft
              </button>
              <button className={styles.primaryButton} type="button" disabled={isSaving || !session} onClick={() => savePost(true)}>
                {isSaving ? "Saving..." : isEditing && form.is_published ? "Update published story" : "Publish story"}
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
                <div className={styles.previewPlaceholder}>Magic Basketball Initiatives</div>
              )}
              <ArticleBody blocks={previewBlocks} fallbackText={form.excerpt} matches={availableMatches} />
            </article>
          </aside>
        </div>
      </div>
    </main>
  );
}
