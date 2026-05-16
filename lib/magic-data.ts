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
};

export type MagicData = {
  teams: Team[];
  players: Player[];
  events: EventItem[];
  matches: Match[];
  news: NewsPost[];
  coachProfile: CoachProfile | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const fallbackMagicData: MagicData = {
  teams: [],
  players: [],
  events: [],
  matches: [],
  news: [],
  coachProfile: null,
};

function canUseSupabase() {
  return Boolean(supabaseUrl && supabaseKey);
}

async function restFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!canUseSupabase()) throw new Error("Supabase environment variables are missing.");

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: supabaseKey!,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed: ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function getMagicData(): Promise<MagicData> {
  if (!canUseSupabase()) return fallbackMagicData;

  try {
    const [teams, players, events, matches, news, coachProfiles] = await Promise.all([
      restFetch<Team[]>("teams?select=*&order=is_home_team.desc,name.asc"),
      restFetch<Player[]>("players?select=*&order=jersey_number.asc"),
      restFetch<EventItem[]>("events?select=*&order=event_date.asc,event_time.asc"),
      restFetch<Match[]>("matches?select=*&order=match_date.desc&limit=8"),
      restFetch<NewsPost[]>("news_posts?select=*&order=published_at.desc&limit=6"),
      restFetch<CoachProfile[]>("coach_profiles?select=*&order=updated_at.desc&limit=1"),
    ]);

    return {
      teams,
      players,
      events,
      matches,
      news,
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

export async function upsertCoachProfile(payload: CoachProfile) {
  return restFetch<CoachProfile[]>("coach_profiles", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(payload),
  });
}

export async function updateCoachProfile(id: string, payload: Omit<CoachProfile, "id">) {
  return restFetch<CoachProfile[]>(`coach_profiles?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
}
