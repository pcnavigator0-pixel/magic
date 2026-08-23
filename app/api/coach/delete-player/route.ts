/**
 * Fully deletes a player and any records that depend on the player row.
 * The Auth Admin API requires the service-role key, so this cleanup stays
 * server-side and is protected by a caller-side coach check.
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization." }), { status: 401 });
    }

    const { playerId } = await request.json();
    if (!playerId || typeof playerId !== "string") {
      return new Response(JSON.stringify({ error: "Missing playerId." }), { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("[Delete Player] Missing Supabase URL or anon key.");
      return new Response(JSON.stringify({ error: "Server configuration error" }), { status: 500 });
    }

    // Verify the caller with their own access token before using the service role.
    const coachCheck = await fetch(`${supabaseUrl}/rest/v1/rpc/is_coach`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const isCoach = await coachCheck.json();
    if (!coachCheck.ok || isCoach !== true) {
      return new Response(JSON.stringify({ error: "Only coaches can remove players." }), { status: 403 });
    }

    // Database cleanup can use the verified coach token when the Vercel
    // service-role variable is unavailable. The service role is only needed
    // for deleting an auth.users account, never for an unregistered player.
    const databaseHeaders = {
      apikey: serviceRoleKey || supabaseAnonKey,
      Authorization: serviceRoleKey ? `Bearer ${serviceRoleKey}` : authHeader,
      "Content-Type": "application/json",
    };

    // The UI normally sends players.id. Keep a registration-code fallback so
    // older/stale dashboard rows can still be removed safely.
    const lookupPlayer = async (filter: string) => {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/players?${filter}&select=id,auth_user_id,registration_code&limit=1`,
        { headers: databaseHeaders, cache: "no-store" },
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        console.error("[Delete Player] Player lookup failed:", response.status, body);
        throw new Error("Could not verify the player record in Supabase.");
      }

      return Array.isArray(body) ? body[0] : null;
    };

    let player = await lookupPlayer(`id=eq.${encodeURIComponent(playerId)}`);
    if (!player) {
      player = await lookupPlayer(`registration_code=eq.${encodeURIComponent(playerId)}`);
    }

    if (!player) {
      return new Response(JSON.stringify({ error: "Player not found in the players table." }), { status: 404 });
    }

    const canonicalPlayerId = player.id;
    const deleteRows = async (table: string, filter: string) => {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/${table}?${filter}`,
        { method: "DELETE", headers: databaseHeaders },
      );

      if (!response.ok) {
        const detail = await response.text();
        console.error(`[Delete Player] Failed to delete from ${table}:`, detail);
        throw new Error(`Failed to clean up ${table}.`);
      }
    };

    const updateRows = async (table: string, filter: string, body: Record<string, unknown>) => {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/${table}?${filter}`,
        {
          method: "PATCH",
          headers: { ...databaseHeaders, Prefer: "return=minimal" },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        const detail = await response.text();
        console.error(`[Delete Player] Failed to update ${table}:`, detail);
        throw new Error(`Failed to clean up ${table}.`);
      }
    };

    // A missing row in any of these tables is harmless: PostgREST returns a
    // successful no-op for a DELETE/PATCH filter with no matching rows.
    await deleteRows("portal_profiles", `player_id=eq.${encodeURIComponent(canonicalPlayerId)}`);
    await deleteRows("notifications", `recipient_player_id=eq.${encodeURIComponent(canonicalPlayerId)}`);
    await updateRows("matches", `mvp_player_id=eq.${encodeURIComponent(canonicalPlayerId)}`, { mvp_player_id: null });
    await deleteRows("players", `id=eq.${encodeURIComponent(canonicalPlayerId)}`);

    if (player.auth_user_id && serviceRoleKey) {
      const authDelete = await fetch(
        `${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(player.auth_user_id)}`,
        { method: "DELETE", headers: databaseHeaders },
      );
      if (!authDelete.ok && authDelete.status !== 404) {
        const detail = await authDelete.text();
        console.error("[Delete Player] Failed to delete auth user:", detail);
        return new Response(
          JSON.stringify({ error: "Player records were removed, but the login could not be deleted. Contact support." }),
          { status: 500 },
        );
      }
    } else if (player.auth_user_id) {
      console.error("[Delete Player] Player row was removed, but SUPABASE_SERVICE_ROLE_KEY is unavailable for Auth cleanup.");
      return new Response(
        JSON.stringify({ error: "Player records were removed, but the login could not be deleted because the server Auth key is not configured." }),
        { status: 500 },
      );
    }

    return new Response(JSON.stringify({ success: true, deletedPlayerId: canonicalPlayerId }), { status: 200 });
  } catch (error) {
    console.error("[Delete Player] Unexpected error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "An unexpected error occurred." }), { status: 500 });
  }
}
