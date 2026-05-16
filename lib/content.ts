export type SiteContent = {
  nav: unknown[];
  hero: Record<string, unknown> | null;
  matches: unknown[];
  standings: unknown[];
  featuredPosts: unknown[];
  news: unknown[];
  portfolio: unknown[];
  partners: unknown[];
};

export const fallbackContent: SiteContent = {
  nav: [],
  hero: null,
  matches: [],
  standings: [],
  featuredPosts: [],
  news: [],
  portfolio: [],
  partners: [],
};

type Row = { section_key: keyof SiteContent; content: unknown };

export async function getSiteContent(): Promise<SiteContent> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return fallbackContent;

  try {
    const response = await fetch(
      `${url.replace(/\/$/, "")}/rest/v1/site_content?select=section_key,content&order=sort_order.asc`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
        next: { revalidate: 60 },
      },
    );

    if (!response.ok) return fallbackContent;

    const rows = (await response.json()) as Row[];
    return rows.reduce<SiteContent>((content, row) => {
      content[row.section_key] = row.content as never;
      return content;
    }, { ...fallbackContent });
  } catch {
    return fallbackContent;
  }
}
