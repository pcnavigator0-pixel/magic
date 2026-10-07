import type { ArticleBlock, Match } from "@/lib/magic-data";

type EmbedProvider = "youtube" | "vimeo" | "social";

type ArticleBodyProps = {
  blocks: ArticleBlock[] | string | null | undefined;
  fallbackText?: string | null;
  className?: string;
  matches?: Match[];
};

export function ArticleBody({ blocks, fallbackText, className, matches = [] }: ArticleBodyProps) {
  const articleBlocks = normalizeArticleBlocks(blocks, fallbackText);

  return (
    <div className={`article-body ${className || ""}`}>
      {articleBlocks.map((block, index) => {
        if (block.type === "paragraph") {
          const align = block.align === "center" || block.align === "right" ? block.align : "left";
          const size = block.size === "small" || block.size === "large" ? block.size : "medium";
          return (
            <div
              className={`article-paragraph-align-${align} article-paragraph-size-${size} ${block.clear ? "article-paragraph-clear" : ""}`}
              key={`paragraph-${index}`}
              dangerouslySetInnerHTML={{ __html: renderRichText(block.text, matches) }}
            />
          );
        }

        if (block.type === "heading") {
          const Heading = `h${block.level}` as "h2" | "h3" | "h4";
          return <Heading key={`heading-${index}`} dangerouslySetInnerHTML={{ __html: renderRichText(block.text, matches) }} />;
        }

        if (block.type === "quote" || block.type === "pullquote") {
          return (
            <figure className={`article-${block.type}`} key={`${block.type}-${index}`}>
              <blockquote dangerouslySetInnerHTML={{ __html: renderRichText(block.text, matches) }} />
              {block.citation && <figcaption>{block.citation}</figcaption>}
            </figure>
          );
        }

        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag className="article-list-block" key={`list-${index}`}>
              {block.items.map((item, itemIndex) => {
                const text = typeof item === "string" ? item : item.text;
                return <li key={`list-item-${itemIndex}`} dangerouslySetInnerHTML={{ __html: renderRichText(text, matches) }} />;
              })}
            </ListTag>
          );
        }

        if (block.type === "table") {
          return (
            <div className="article-table-wrap" key={`table-${index}`}>
              <table className="article-table">
                <thead><tr>{block.headers.map((header, headerIndex) => <th key={`header-${headerIndex}`} dangerouslySetInnerHTML={{ __html: renderRichText(header, matches) }} />)}</tr></thead>
                <tbody>{block.rows.map((row, rowIndex) => <tr key={`row-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`cell-${rowIndex}-${cellIndex}`} dangerouslySetInnerHTML={{ __html: renderRichText(cell, matches) }} />)}</tr>)}</tbody>
              </table>
            </div>
          );
        }

        if (block.type === "embed") {
          const embedUrl = getEmbedUrl(block.url, block.provider);
          return (
            <figure className="article-embed" key={`embed-${index}`}>
              {embedUrl ? <iframe src={embedUrl} title={block.caption || `${block.provider} embed`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : <a href={block.url} rel="noreferrer" target="_blank">Open embedded content</a>}
              {block.caption && <figcaption>{block.caption}</figcaption>}
            </figure>
          );
        }

        const align = block.align === "right" || block.align === "full" ? block.align : "left";
        const width = block.width === "small" || block.width === "large" ? block.width : "medium";
        const crop = block.crop || { zoom: 1, x: 50, y: 50 };
        return (
          <figure className={`article-image-block article-image-${align} article-image-width-${width}`} key={`image-${block.url}-${index}`}>
            <div className="article-image-frame">
              <img src={block.url} alt={block.caption || ""} style={{ objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.zoom})` }} />
            </div>
            {block.caption && <figcaption>{block.caption}</figcaption>}
          </figure>
        );
      })}
    </div>
  );
}

export function normalizeArticleBlocks(
  blocks: ArticleBlock[] | string | null | undefined,
  fallbackText?: string | null,
): ArticleBlock[] {
  if (Array.isArray(blocks)) {
    return blocks
      .map((block): ArticleBlock | null => {
        if (block?.type === "paragraph") {
          const text = String(block.text || "");
          return text.trim() ? { type: "paragraph", text, align: block.align === "center" || block.align === "right" ? block.align : "left", size: block.size === "small" || block.size === "large" ? block.size : "medium", clear: block.clear === true, related_match_ids: Array.isArray(block.related_match_ids) ? block.related_match_ids.map(String).filter(Boolean) : [] } : null;
        }
        if (block?.type === "heading" || block?.type === "quote" || block?.type === "pullquote") {
          const text = String(block.text || "");
          if (!text.trim()) return null;
          return block.type === "heading" ? { type: "heading", text, level: block.level === 3 || block.level === 4 ? block.level : 2 } : { type: block.type, text, citation: block.citation ? String(block.citation).trim() : null };
        }
        if (block?.type === "list") {
          const items = Array.isArray(block.items) ? block.items.map((item) => typeof item === "string" ? { text: item, related_match_ids: [] } : { text: String(item.text || ""), related_match_ids: item.related_match_ids || [] }).filter((item) => item.text.trim()) : [];
          return items.length ? { type: "list", ordered: block.ordered === true, items } : null;
        }
        if (block?.type === "table") {
          const headers = Array.isArray(block.headers) ? block.headers.map(String) : [];
          const rows = Array.isArray(block.rows) ? block.rows.map((row) => Array.isArray(row) ? row.map(String) : []).filter((row) => row.length) : [];
          return headers.length ? { type: "table", headers, rows } : null;
        }
        if (block?.type === "embed") {
          const url = String(block.url || "").trim();
          return url ? { type: "embed", url, provider: block.provider === "vimeo" || block.provider === "social" ? block.provider : "youtube", caption: block.caption ? String(block.caption).trim() : null } : null;
        }
        if (block?.type === "image") {
          const url = String(block.url || "").trim();
          if (!url) return null;
          const crop = block.crop && typeof block.crop === "object" ? { zoom: Math.min(2, Math.max(1, Number(block.crop.zoom) || 1)), x: Math.min(100, Math.max(0, Number(block.crop.x) || 50)), y: Math.min(100, Math.max(0, Number(block.crop.y) || 50)) } : { zoom: 1, x: 50, y: 50 };
          return { type: "image", url, align: block.align === "right" || block.align === "full" ? block.align : "left", width: block.width === "small" || block.width === "large" ? block.width : "medium", caption: block.caption ? String(block.caption).trim() : null, crop };
        }
        return null;
      })
      .filter((block): block is ArticleBlock => Boolean(block));
  }

  const source = typeof blocks === "string" && blocks.trim() ? blocks : fallbackText;
  if (!source?.trim()) return [{ type: "paragraph", text: "Full story details will be added soon." }];
  return source.split(/\n{2,}|\r\n{2,}/).map((paragraph) => paragraph).filter((paragraph) => paragraph.trim()).map((text) => ({ type: "paragraph" as const, text }));
}

function renderRichText(text: string, matches: Match[]) {
  const withMatches = text.replace(/\[\[match:([^\]]+)\]\]/g, (_, matchId: string) => {
    const match = matches.find((candidate) => candidate.id === matchId);
    return match ? `<a class="article-match-link" href="/matches#match-${match.id}">View Match</a>` : "";
  });
  return sanitizeInlineHtml(withMatches);
}

function sanitizeInlineHtml(value: string) {
  let html = value.replace(/<\/?(script|style|iframe|object|embed)[^>]*>/gi, "");
  html = html.replace(/<([a-z0-9]+)([^>]*)>/gi, (full, rawTag: string, rawAttrs: string) => {
    const tag = rawTag.toLowerCase();
    if (!["a", "b", "br", "em", "font", "i", "s", "span", "strong", "u", "div", "p"].includes(tag)) return "";
    if (tag === "br" || tag === "b" || tag === "em" || tag === "i" || tag === "s" || tag === "strong" || tag === "u" || tag === "div" || tag === "p") return `<${tag}>`;
    if (tag === "a") {
      const href = rawAttrs.match(/href\s*=\s*["']([^"']+)["']/i)?.[1] || "";
      if (!/^(https?:\/\/|mailto:|\/|#)/i.test(href)) return "";
      return `<a href="${escapeAttribute(href)}" target="_blank" rel="noreferrer noopener">`;
    }
    const color = rawAttrs.match(/(?:color|style\s*=\s*["'][^"']*color\s*:)\s*["']?\s*(#[0-9a-f]{3,8}|[a-z]+)\s*["']?/i)?.[1];
    return color ? `<span style="color:${escapeAttribute(color)}">` : `<${tag}>`;
  });
  return html.replace(/<\/([a-z0-9]+)>/gi, (_, rawTag: string) => ["a", "b", "em", "font", "i", "s", "span", "strong", "u", "div", "p"].includes(rawTag.toLowerCase()) ? `</${rawTag.toLowerCase()}>` : "");
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function getEmbedUrl(url: string, provider: EmbedProvider) {
  if (provider === "social") return "";
  if (provider === "youtube") {
    const id = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^?&/]+)/i)?.[1];
    return id ? `https://www.youtube.com/embed/${id}` : "";
  }
  const id = url.match(/vimeo\.com\/(\d+)/i)?.[1];
  return id ? `https://player.vimeo.com/video/${id}` : "";
}
