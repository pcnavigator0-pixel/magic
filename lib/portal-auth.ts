export type PortalRole = "coach" | "player";

export type PortalProfile = {
  id: string;
  email: string;
  full_name: string;
  role: PortalRole;
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
    throw new Error("This account does not have a MAGIC BBC portal role yet.");
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
    throw new Error("This account does not have a MAGIC BBC portal role yet.");
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

  if (session.expires_at > Date.now() + 60_000) {
    return session;
  }

  try {
    return await refreshPortalSession(session);
  } catch {
    clearPortalSession();
    return null;
  }
}

export async function registerPortalAccount({
  email,
  password,
  fullName,
  role,
}: {
  email: string;
  password: string;
  fullName: string;
  role: PortalRole;
}) {
  const auth = await authFetch("signup", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      data: {
        full_name: fullName,
        role,
      },
    }),
  });

  return {
    created: Boolean(auth.user || auth.access_token || auth.refresh_token || auth),
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

export function clearPortalSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey);
}
