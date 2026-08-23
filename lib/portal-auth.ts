export type PortalRole = "coach" | "player";

export type PortalProfile = {
  id: string;
  email: string;
  full_name: string;
  role: PortalRole;
  player_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type PortalSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: {
    id: string;
    email?: string;
  };
  profile: PortalProfile;
};

type AuthResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: {
    id: string;
    email?: string;
  };
  error?: string;
  error_description?: string;
  msg?: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const storageKey = "magic.portal.session";

function ensureSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables are missing.");
  }

  return { supabaseUrl, supabaseKey };
}

function authHeaders(accessToken?: string) {
  const { supabaseKey } = ensureSupabase();

  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${accessToken || supabaseKey}`,
    "Content-Type": "application/json",
  };
}

async function getAuthenticatedUser(accessToken: string): Promise<{ id: string; email?: string }> {
  const { supabaseUrl } = ensureSupabase();
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    cache: "no-store",
    headers: authHeaders(accessToken),
  });

  if (!response.ok) {
    throw new Error("Supabase session is no longer valid.");
  }

  const user = (await response.json()) as { id?: string; email?: string };
  if (!user.id) {
    throw new Error("Supabase did not return an authenticated user.");
  }

  return { id: user.id, email: user.email };
}

async function authFetch(path: string, init: RequestInit) {
  const { supabaseUrl } = ensureSupabase();
  const response = await fetch(`${supabaseUrl}/auth/v1/${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init.headers || {}),
    },
  });
  const body = (await response.json()) as AuthResponse;

  if (!response.ok) {
    throw new Error(body.error_description || body.msg || body.error || "Authentication failed.");
  }

  return body;
}

async function restFetch<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const { supabaseUrl } = ensureSupabase();
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...authHeaders(accessToken),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed: ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function profilePath(userId: string) {
  return `portal_profiles?id=eq.${encodeURIComponent(userId)}&select=*`;
}

export function dashboardPath(role: PortalRole) {
  return role === "coach" ? "/coach-dashboard" : "/player-dashboard";
}

export async function getPortalProfile(userId: string, accessToken: string) {
  const profiles = await restFetch<PortalProfile[]>(profilePath(userId), accessToken);
  return profiles[0] || null;
}

export async function signInToPortal(email: string, password: string) {
  const auth = await authFetch("token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (!auth.access_token || !auth.refresh_token || !auth.user) {
    throw new Error("Supabase did not return a login session.");
  }

  const profile = await getPortalProfile(auth.user.id, auth.access_token);
  if (!profile) {
    throw new Error("This account does not have a Magic Initiative Rwanda portal role yet.");
  }

  const session: PortalSession = {
    access_token: auth.access_token,
    refresh_token: auth.refresh_token,
    expires_at: Date.now() + (auth.expires_in || 3600) * 1000,
    user: auth.user,
    profile,
  };

  savePortalSession(session);
  return session;
}

export async function refreshPortalSession(session: PortalSession) {
  const auth = await authFetch("token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });

  if (!auth.access_token || !auth.refresh_token || !auth.user) {
    throw new Error("Supabase did not return a refreshed login session.");
  }

  const profile = await getPortalProfile(auth.user.id, auth.access_token);
  if (!profile) {
    throw new Error("This account does not have a Magic Initiative Rwanda portal role yet.");
  }

  const refreshedSession: PortalSession = {
    access_token: auth.access_token,
    refresh_token: auth.refresh_token,
    expires_at: Date.now() + (auth.expires_in || 3600) * 1000,
    user: auth.user,
    profile,
  };

  savePortalSession(refreshedSession);
  return refreshedSession;
}

export async function getFreshPortalSession() {
  const session = getStoredPortalSession();
  if (!session) return null;

  try {
    const authenticatedUser = await getAuthenticatedUser(session.access_token);
    const profile = await getPortalProfile(authenticatedUser.id, session.access_token);

    if (!profile) {
      throw new Error("This portal profile is no longer available.");
    }

    if (session.expires_at > Date.now() + 60_000) {
      const verifiedSession: PortalSession = {
        ...session,
        user: {
          id: authenticatedUser.id,
          email: authenticatedUser.email,
        },
        profile,
      };
      savePortalSession(verifiedSession);
      return verifiedSession;
    }

    return await refreshPortalSession({ ...session, user: authenticatedUser, profile });
  } catch {
    clearPortalSession();
    return null;
  }
}

/**
 * Registers a player using their registration code.
 *
 * Flow:
 *  1. Check the code via the verify_registration_code() Postgres function
 *     (anon-callable, never exposes other players' data).
 *  2. Create the Supabase auth account for the player.
 *  3. Call the complete_player_registration() Postgres function USING THE
 *     NEW USER'S OWN ACCESS TOKEN. That function is SECURITY DEFINER and,
 *     in one atomic transaction, both updates the players row and creates
 *     the portal_profiles row — so there's no longer a window where the
 *     auth account exists but isn't linked to a player.
 */
export async function registerPlayerWithCode({
  registrationCode,
  fullName,
  email,
  password,
}: {
  registrationCode: string;
  fullName: string;
  email: string;
  password: string;
}) {
  // 0. Verify the code first, before creating any auth account.
  const { checkRegistrationCode } = await import("./magic-data");

  const codeCheck = await checkRegistrationCode(registrationCode);

  if (codeCheck.status === "not_found") {
    throw new Error(`Code "${registrationCode}" not found in our system. Please check the code and try again.`);
  }

  if (codeCheck.status === "already_used") {
    throw new Error("This registration code has already been used.");
  }

  // 1. Create the Supabase auth account (only now that the code is valid).
  const auth = await authFetch("signup", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      data: {
        full_name: fullName,
        role: "player",
      },
    }),
  });

  if (!auth.user?.id || !auth.access_token) {
    throw new Error("Failed to create auth account. Please try again.");
  }

  // 2. Complete registration via the secure API route, using the NEW
  //    user's own access token so the database can verify they're
  //    registering themselves (not someone else's account).
  let player;
  try {
    const completeResponse = await fetch("/api/player-register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.access_token}`,
      },
      body: JSON.stringify({
        registrationCode,
        fullName,
        email,
        authUserId: auth.user.id,
      }),
    });

    const result = await completeResponse.json();

    if (!completeResponse.ok) {
      throw new Error(result.error || "Failed to complete player registration");
    }

    player = result.player;
  } catch (error) {
    throw new Error(
      `Registration could not be completed: ${error instanceof Error ? error.message : "Unknown error"}. ` +
      `Your login was created but isn't linked to a player yet — please contact your coach.`
    );
  }

  if (!player || !player.is_registered) {
    throw new Error("Failed to complete player registration. Please contact your coach.");
  }

  return {
    success: true,
    userId: auth.user.id,
  };
}

export function savePortalSession(session: PortalSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(session));
}

export function getStoredPortalSession() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const session = JSON.parse(raw) as PortalSession;

    if (!session.access_token || !session.profile?.role) {
      clearPortalSession();
      return null;
    }

    return session;
  } catch {
    clearPortalSession();
    return null;
  }
}

export async function signOutFromPortal() {
  const session = getStoredPortalSession();
  clearPortalSession();

  try {
    if (session) {
      const { supabaseUrl } = ensureSupabase();
      await fetch(`${supabaseUrl}/auth/v1/logout`, {
        method: "POST",
        cache: "no-store",
        headers: authHeaders(session.access_token),
      });
    }
  } catch {
    // Local cleanup below is the source of truth for the portal UI.
  }
}

export function clearPortalSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey);
}
