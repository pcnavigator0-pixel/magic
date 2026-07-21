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
  registration_code: string;
  is_registered: boolean;
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
  content: ArticleBlock[] | string | null;
  image_url: string | null;
  published_at: string;
  is_published: boolean;
};

export type ArticleBlock =
  | { type: "paragraph"; text: string }
  | { type: "image"; url: string; align: "left" | "right"; caption: string | null };

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

export type Notification = {
  id: string;
  recipient_player_id: string;
  sender_coach_id: string | null;
  message: string;
  duration_days: number;
  created_at: string;
  expires_at: string;
  is_read: boolean;
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
  notifications: Notification[];
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
  notifications: [],
  coachProfile: null,
};

function canUseSupabase() {
  return Boolean(supabaseUrl && supabaseKey);
}

async function restFetch<T>(path: string, init?: RequestInit, accessToken?: string): Promise<T> {
  if (!canUseSupabase()) throw new Error("Supabase environment variables are missing.");

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      ...init,
      cache: init?.cache || "no-store",
      headers: {
        apikey: supabaseKey!,
        Authorization: `Bearer ${accessToken || supabaseKey}`,
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });

    if (!response.ok) {
      let detail = "";
      try {
        const body = await response.text();
        if (body) {
          try {
            const parsed = JSON.parse(body);
            detail = parsed.message || parsed.hint || parsed.details || body;
          } catch {
            detail = body;
          }
        }
      } catch {
        // ignore — fall back to status-only message below
      }
      throw new Error(`Supabase request failed: ${response.status}${detail ? ` — ${detail}` : ""}`);
    }

    if (response.status === 204) return undefined as T;

    const text = await response.text();
    if (!text) return undefined as T;

    return JSON.parse(text) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch from Supabase';
    console.error(`[restFetch] Error fetching ${path}:`, message);
    throw error;
  }
}

async function useFallbackOnError<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

/**
 * Fetches site-wide data.
 *
 * - Called with no accessToken (public pages): players come from the
 *   `players_public` view, which never includes registration_code,
 *   email, auth_user_id, or is_registered. Notifications are skipped
 *   entirely (anon has no access — they're per-player private data).
 * - Called with a player's accessToken: same players_public view (a
 *   player doesn't need to see other players' private fields either),
 *   but notifications are now fetched with their token so RLS scopes
 *   the result to just their own messages.
 * - Called with a coach's accessToken and isCoach=true: fetches the
 *   FULL players table (needed for the roster management screen —
 *   registration codes, is_registered, email) and all notifications.
 *   RLS still enforces that only an actual coach account can read this.
 */
export async function getMagicData(accessToken?: string, isCoach = false): Promise<MagicData> {
  if (!canUseSupabase()) return fallbackMagicData;

  try {
    const playersPath = isCoach && accessToken
      ? "players?select=*&order=jersey_number.asc"
      : "players_public?select=*&order=jersey_number.asc";

    const [teams, players, events, matches, news, products, coachProfiles, notifications] = await Promise.all([
      useFallbackOnError(restFetch<Team[]>("teams?select=*&order=is_home_team.desc,name.asc"), []),
      useFallbackOnError(restFetch<Player[]>(playersPath, undefined, accessToken), []),
      useFallbackOnError(restFetch<EventItem[]>("events?select=*&order=event_date.desc,event_time.desc"), []),
      useFallbackOnError(restFetch<Match[]>("matches?select=*&order=match_date.desc&limit=100"), []),
      useFallbackOnError(restFetch<NewsPost[]>("news_posts?select=*&order=published_at.desc&limit=100"), []),
      useFallbackOnError(restFetch<ShopProduct[]>("shop_products?select=*&is_published=eq.true&order=is_featured.desc,name.asc&limit=100"), []),
      useFallbackOnError(restFetch<CoachProfile[]>("coach_profiles?select=*&order=updated_at.desc&limit=1"), []),
      accessToken
        ? useFallbackOnError(restFetch<Notification[]>("notifications?select=*&expires_at=gt.now()&order=created_at.desc", undefined, accessToken), [])
        : Promise.resolve<Notification[]>([]),
    ]);

    return {
      teams,
      players,
      events,
      matches,
      news,
      products,
      notifications,
      coachProfile: coachProfiles[0] || null,
    };
  } catch {
    return fallbackMagicData;
  }
}

export async function getAllEvents(): Promise<EventItem[]> {
  if (!canUseSupabase()) return [];

  const pageSize = 1000;
  const maxPages = 100;
  const events: EventItem[] = [];

  try {
    for (let page = 0; page < maxPages; page += 1) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const rows = await restFetch<EventItem[]>(
        "events?select=*&order=event_date.desc,event_time.desc",
        {
          headers: {
            Range: `${from}-${to}`,
            "Range-Unit": "items",
          },
        },
      );

      events.push(...rows);

      if (rows.length < pageSize) break;
    }

    return events;
  } catch {
    return [];
  }
}

export async function getNewsPostBySlug(slug: string): Promise<NewsPost | null> {
  if (!canUseSupabase()) return null;

  const posts = await restFetch<NewsPost[]>(
    `news_posts?slug=eq.${encodeURIComponent(slug)}&is_published=eq.true&select=*&limit=1`,
  );

  return posts[0] || null;
}

export async function getNewsPostById(id: string, accessToken?: string): Promise<NewsPost | null> {
  if (!canUseSupabase()) return null;

  const posts = await restFetch<NewsPost[]>(
    `news_posts?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
    undefined,
    accessToken,
  );

  return posts[0] || null;
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
      const magic = ensure("Magic Initiative Rwanda");
      const opponent = match.opponent_name ? ensure(match.opponent_name) : null;

      magic.played += 1;
      if (opponent) opponent.played += 1;

      if (match.home_score > match.away_score) {
        magic.wins += 1;
        magic.points += 2;
        if (opponent) opponent.losses += 1;
      } else if (match.home_score < match.away_score) {
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

export async function insertPlayer(payload: Omit<Player, "id" | "registration_code" | "is_registered" | "auth_user_id" | "email">, accessToken?: string) {
  const registration_code = generateRegistrationCode();
  
  // Use public anon key if no accessToken provided
  return restFetch<Player[]>("players", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      ...payload,
      registration_code,
      is_registered: false,
    }),
  }, accessToken);
}

export async function insertMatch(payload: Omit<Match, "id">) {
  return restFetch<Match[]>("matches", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
}

export async function insertNewsPost(payload: Omit<NewsPost, "id">, accessToken?: string) {
  return restFetch<NewsPost[]>("news_posts", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  }, accessToken);
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

export async function updatePlayer(id: string, payload: Omit<Player, "id" | "registration_code" | "is_registered" | "auth_user_id" | "email">, accessToken?: string) {
  const updatedRows = await restFetch<Player[]>(`players?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  }, accessToken);

  if (!updatedRows || updatedRows.length === 0) {
    throw new Error("No matching player was updated. Your database policy may be blocking this — make sure you're signed in as the coach.");
  }

  return updatedRows;
}

export async function updateMatch(id: string, payload: Omit<Match, "id">) {
  return restFetch<Match[]>(`matches?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
}

export async function updateNewsPost(id: string, payload: Omit<NewsPost, "id">, accessToken?: string) {
  return restFetch<NewsPost[]>(`news_posts?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  }, accessToken);
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

/**
 * Deletes a player completely: their portal_profiles row, their players
 * row, and (if they've registered) their Supabase Auth login. Goes
 * through /api/coach/delete-player because removing an Auth login
 * requires the service role key, which never runs in the browser.
 */
export async function deletePlayerFully(playerId: string, accessToken: string) {
  const response = await fetch("/api/coach/delete-player", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ playerId }),
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.error || "Failed to delete player.");
  }

  return result;
}

export async function deletePlayer(id: string, accessToken?: string) {
  return deleteRow<Player>("players", id, accessToken);
}

export async function deleteMatch(id: string) {
  return deleteRow<Match>("matches", id);
}

export async function deleteNewsPost(id: string, accessToken?: string) {
  return deleteRow<NewsPost>("news_posts", id, accessToken);
}

export async function deleteShopProduct(id: string, accessToken?: string) {
  return deleteRow<ShopProduct>("shop_products", id, accessToken);
}

export async function insertNotification(payload: {
  recipient_player_id: string;
  sender_coach_id?: string | null;
  message: string;
  duration_days: number;
}, accessToken?: string) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + payload.duration_days);

  return restFetch<Notification[]>("notifications", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      recipient_player_id: payload.recipient_player_id,
      sender_coach_id: payload.sender_coach_id || null,
      message: payload.message,
      duration_days: payload.duration_days,
      expires_at: expiresAt.toISOString(),
    }),
  }, accessToken);
}

export async function updateNotification(id: string, payload: Partial<Omit<Notification, "id">>, accessToken?: string) {
  return restFetch<Notification[]>(`notifications?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  }, accessToken);
}

export async function deleteNotification(id: string, accessToken?: string) {
  return deleteRow<Notification>("notifications", id, accessToken);
}

export async function getNotificationsForPlayer(playerId: string, accessToken?: string) {
  const notifications = await restFetch<Notification[]>(
    `notifications?recipient_player_id=eq.${encodeURIComponent(playerId)}&expires_at=gt.now()&order=created_at.desc`,
    undefined,
    accessToken,
  );

  return notifications || [];
}

/**
 * Generates a unique 8-character alphanumeric registration code
 * Used when coaches create new player profiles
 */
export function generateRegistrationCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export type RegistrationCodeCheck =
  | { status: "ok"; player: { id: string; full_name: string; jersey_number: number; position: string; height: string | null } }
  | { status: "not_found" }
  | { status: "already_used" };

/**
 * Checks a registration code via the verify_registration_code() Postgres
 * function. This is the ONLY way the app looks up a code now — it never
 * reads the players table directly with the anon key, so it can't be used
 * to enumerate other players' codes, emails, or registration status.
 */
export async function checkRegistrationCode(registrationCode: string): Promise<RegistrationCodeCheck> {
  const rows = await restFetch<Array<{
    status: "ok" | "not_found" | "already_used";
    player_id: string | null;
    full_name: string | null;
    jersey_number: number | null;
    position: string | null;
    height: string | null;
  }>>("rpc/verify_registration_code", {
    method: "POST",
    body: JSON.stringify({ p_code: registrationCode }),
  });

  const result = rows?.[0];

  if (!result || result.status !== "ok" || !result.player_id) {
    return { status: result?.status === "already_used" ? "already_used" : "not_found" };
  }

  return {
    status: "ok",
    player: {
      id: result.player_id,
      full_name: result.full_name || "",
      jersey_number: result.jersey_number ?? 0,
      position: result.position || "",
      height: result.height,
    },
  };
}

export async function getPlayerProfileWithPortal(playerId: string, accessToken?: string) {
  const players = await restFetch<Player[]>(
    `players?id=eq.${encodeURIComponent(playerId)}&limit=1`,
    undefined,
    accessToken
  );
  
  const player = players?.[0];
  if (!player) return null;

  // Get portal profile if auth_user_id exists
  let portalProfile = null;
  if (player.auth_user_id) {
    const profiles = await restFetch<any[]>(
      `portal_profiles?id=eq.${encodeURIComponent(player.auth_user_id)}&limit=1`,
      undefined,
      accessToken
    );
    portalProfile = profiles?.[0] || null;
  }

  return {
    player,
    portalProfile,
  };
}
