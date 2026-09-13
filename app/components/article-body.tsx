import type { ArticleBlock, Match } from "@/lib/magic-data";

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
          const weight = block.weight === "bold" ? "bold" : "normal";
          const relatedMatches = (block.related_match_ids || [])
            .map((id) => matches.find((match) => match.id === id))
            .filter((match): match is Match => Boolean(match));
          return <p className={`article-paragraph-align-${align} article-paragraph-size-${size} article-paragraph-weight-${weight} ${block.clear ? "article-paragraph-clear" : ""}`} key={`paragraph-${index}`}>
            {block.text}
            {relatedMatches.map((match) => <a className="article-match-link" href={`/matches#match-${match.id}`} key={match.id}>View Match</a>)}
          </p>;
        }

        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return <ListTag className="article-list-block" key={`list-${index}`}>
            {block.items.map((item, itemIndex) => <li key={`list-item-${itemIndex}`}>{item}</li>)}
          </ListTag>;
        }

        const align = block.align === "right" || block.align === "full" ? block.align : "left";
        const width = block.width === "small" || block.width === "large" ? block.width : "medium";

        return (
          <figure className={`article-image-block article-image-${align} article-image-width-${width}`} key={`image-${block.url}-${index}`}>
            <img src={block.url} alt={block.caption || ""} />
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
          const text = String(block.text || "").trim();
          return text ? {
            type: "paragraph" as const,
            text,
            align: block.align === "center" || block.align === "right" ? block.align : "left" as const,
            weight: block.weight === "bold" ? "bold" as const : "normal" as const,
            size: block.size === "small" || block.size === "large" ? block.size : "medium" as const,
            clear: block.clear === true,
            related_match_ids: Array.isArray(block.related_match_ids) ? block.related_match_ids.map(String).filter(Boolean) : [],
          } : null;
        }

        if (block?.type === "list") {
          const items = Array.isArray(block.items)
            ? block.items.map((item) => String(item || "").trim()).filter(Boolean)
            : [];
          return items.length ? { type: "list" as const, ordered: block.ordered === true, items } : null;
        }

        if (block?.type === "image") {
          const url = String(block.url || "").trim();
          if (!url) return null;

          return {
            type: "image" as const,
            url,
            align: block.align === "right" || block.align === "full" ? block.align : "left" as const,
            width: block.width === "small" || block.width === "large" ? block.width : "medium" as const,
            caption: block.caption ? String(block.caption).trim() : null,
          };
        }

        return null;
      })
      .filter((block): block is ArticleBlock => Boolean(block));
  }

  const source = typeof blocks === "string" && blocks.trim() ? blocks : fallbackText;

  if (!source?.trim()) {
    return [{ type: "paragraph", text: "Full story details will be added soon." }];
  }

  return source
    .split(/\n{2,}|\r\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((text) => ({ type: "paragraph", text }));
}
