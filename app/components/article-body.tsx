import type { ArticleBlock } from "@/lib/magic-data";

type ArticleBodyProps = {
  blocks: ArticleBlock[] | string | null | undefined;
  fallbackText?: string | null;
  className?: string;
};

export function ArticleBody({ blocks, fallbackText, className }: ArticleBodyProps) {
  const articleBlocks = normalizeArticleBlocks(blocks, fallbackText);

  return (
    <div className={`article-body ${className || ""}`}>
      {articleBlocks.map((block, index) => {
        if (block.type === "paragraph") {
          return <p key={`paragraph-${index}`}>{block.text}</p>;
        }

        const align = block.align === "right" ? "right" : "left";

        return (
          <figure className={`article-image-block article-image-${align}`} key={`image-${block.url}-${index}`}>
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
      .map((block) => {
        if (block?.type === "paragraph") {
          const text = String(block.text || "").trim();
          return text ? { type: "paragraph" as const, text } : null;
        }

        if (block?.type === "image") {
          const url = String(block.url || "").trim();
          if (!url) return null;

          return {
            type: "image" as const,
            url,
            align: block.align === "right" ? "right" as const : "left" as const,
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
