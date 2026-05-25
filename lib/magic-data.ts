export type Team = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  city: string | null;
  primary_color: string;
  is_home_team: boolean;
};

export type Player = {
  id: string;
  full_name: string;
  jersey_number: number;
  position: string;
  height: string | null;
  bio: string | null;
  photo_url: string | null;
  status: "active" | "injured" | "inactive";
  auth_user_id?: string | null;
  email?: string | null;
};

export type EventItem = {
  id: string;
  title: string;
  category: string;
  event_date: string;
  event_time: string | null;
  venue: string;
  description: string | null;
  is_published: boolean;
};

export type Match = {
  id: string;
  match_date: string;
  opponent_name: string | null;
  home_score: number;
  away_score: number;
  venue: string | null;
  league: string;
  mvp_name: string | null;
  status: "scheduled" | "final";
};

export type NewsPost = {
  id: string;
  title: string;
  slug: string;
  category: string;
  excerpt: string | null;
  content: string | null;
  image_url: string | null;
  published_at: string;
  is_published: boolean;
};

export type CoachProfile = {
  id: string;
  full_name: string;
  role: string;
  club_name: string;
  email: string | null;
  phone: string | null;
  training_base: string | null;
  bio: string | null;
  avatar_url: string | null;
  auth_user_id?: string | null;
};

export type ShopProduct = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  price_cents: number;
  currency: string;
  image_url: string | null;
  inventory_count: number;
  is_featured: boolean;
  is_published: boolean;
};

export type MagicData = {
  teams: Team[];
  players: Player[];
  events: EventItem[];
  matches: Match[];
  news: NewsPost[];
  products: ShopProduct[];
  coachProfile: CoachProfile | null;
};

export type Standing = {
  team: string;
  played: number;
  wins: number;
  losses: number;
  points: number;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const fallbackMagicData: MagicData = {
  teams: [],
  players: [],
  events: [],
  matches: [],
  news: [],
  products: [],
  coachProfile: null,
};

function canUseSupabase() {
  return Boolean(supabaseUrl && supabaseKey);
}

async function restFetch<T>(path: string, init?: RequestInit, accessToken?: string): Promise<T> {
  if (!canUseSupabase()) throw new Error("Supabase environment variables are missing.");

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: supabaseKey!,
      Authorization: `Bearer ${accessToken || supabaseKey}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed: ${response.status}`);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  if (!text) return undefined as T;

  return JSON.parse(text) as T;
}

export async function getMagicData(): Promise<MagicData> {
  if (!canUseSupabase()) return fallbackMagicData;

  try {
    const [teams, players, events, matches, news, products, coachProfiles] = await Promise.all([
      restFetch<Team[]>("teams?select=*&order=is_home_team.desc,name.asc"),
      restFetch<Player[]>("players?select=*&order=jersey_number.asc"),
      restFetch<EventItem[]>("events?select=*&order=event_date.asc,event_time.asc"),
      restFetch<Match[]>("matches?select=*&order=match_date.desc&limit=100"),
      restFetch<NewsPost[]>("news_posts?select=*&order=published_at.desc&limit=100"),
      restFetch<ShopProduct[]>("shop_products?select=*&is_published=eq.true&order=is_featured.desc,name.asc&limit=100"),
      restFetch<CoachProfile[]>("coach_profiles?select=*&order=updated_at.desc&limit=1"),
    ]);

    return {
      teams,
      players,
      events,
      matches,
      news,
      products,
      coachProfile: coachProfiles[0] || null,
    };
  } catch {
    return fallbackMagicData;
  }
}

export function createSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function daysUntil(value: string) {
  const start = new Date();
  const end = new Date(`${value}T00:00:00`);
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
}

export function buildStandings(matches: Match[]) {
  const table = new Map<string, Standing>();

  function ensure(team: string) {
    if (!table.has(team)) {
      table.set(team, { team, played: 0, wins: 0, losses: 0, points: 0 });
    }

    return table.get(team)!;
  }

  matches
    .filter((match) => match.status === "final")
    .forEach((match) => {
      const magic = ensure("MAGIC BBC");
      const opponent = match.opponent_name ? ensure(match.opponent_name) : null;

      magic.played += 1;
      if (opponent) opponent.played += 1;

      if (match.home_score >= match.away_score) {
        magic.wins += 1;
        magic.points += 2;
        if (opponent) opponent.losses += 1;
      } else {
        if (opponent) {
          opponent.wins += 1;
          opponent.points += 2;
        }
        magic.losses += 1;
      }
    });

  return Array.from(table.values()).sort((a, b) => b.points - a.points || b.wins - a.wins || a.team.localeCompare(b.team));
}

export async function insertEvent(payload: Omit<EventItem, "id">) {
  return restFetch<EventItem[]>("events", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
}

export async function insertPlayer(payload: Omit<Player, "id">) {
  return restFetch<Player[]>("players", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
}

export async function insertMatch(payload: Omit<Match, "id">) {
  return restFetch<Match[]>("matches", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
}

export async function insertNewsPost(payload: Omit<NewsPost, "id">) {
  return restFetch<NewsPost[]>("news_posts", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
}

export async function insertShopProduct(payload: Omit<ShopProduct, "id">, accessToken?: string) {
  return restFetch<ShopProduct[]>("shop_products", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  }, accessToken);
}

export async function upsertCoachProfile(payload: CoachProfile) {
  return restFetch<CoachProfile[]>("coach_profiles", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(payload),
  });
}

export async function getCoachProfileForUser(userId: string, accessToken?: string) {
  const profiles = await restFetch<CoachProfile[]>(
    `coach_profiles?auth_user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
    undefined,
    accessToken,
  );

  return profiles[0] || null;
}

export async function insertCoachProfile(payload: Omit<CoachProfile, "id">, accessToken?: string) {
  return restFetch<CoachProfile[]>("coach_profiles", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  }, accessToken);
}

export async function updateCoachProfile(id: string, payload: Omit<CoachProfile, "id">, accessToken?: string) {
  return restFetch<CoachProfile[]>(`coach_profiles?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  }, accessToken);
}

export async function updateEvent(id: string, payload: Omit<EventItem, "id">) {
  return restFetch<EventItem[]>(`events?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
}

export async function updatePlayer(id: string, payload: Omit<Player, "id">) {
  return restFetch<Player[]>(`players?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
}

export async function updateMatch(id: string, payload: Omit<Match, "id">) {
  return restFetch<Match[]>(`matches?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
}

export async function updateNewsPost(id: string, payload: Omit<NewsPost, "id">) {
  return restFetch<NewsPost[]>(`news_posts?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
}

export async function updateShopProduct(id: string, payload: Omit<ShopProduct, "id">, accessToken?: string) {
  const updatedRows = await restFetch<ShopProduct[]>(`shop_products?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  }, accessToken);

  if (!updatedRows || updatedRows.length === 0) {
    throw new Error("No matching product was edited. Your database policy may be blocking product updates.");
  }

  return updatedRows;
}

async function deleteRow<T>(table: string, id: string, accessToken?: string) {
  const deletedRows = await restFetch<T[]>(`${table}?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  }, accessToken);

  if (!deletedRows || deletedRows.length === 0) {
    throw new Error("No matching record was deleted. It may already be gone or your database policy blocked the action.");
  }

  return deletedRows;
}

export async function deleteEvent(id: string) {
  return deleteRow<EventItem>("events", id);
}

export async function deletePlayer(id: string) {
  return deleteRow<Player>("players", id);
}

export async function deleteMatch(id: string) {
  return deleteRow<Match>("matches", id);
}

export async function deleteNewsPost(id: string) {
  return deleteRow<NewsPost>("news_posts", id);
}

export async function deleteShopProduct(id: string, accessToken?: string) {
  return deleteRow<ShopProduct>("shop_products", id, accessToken);
}
