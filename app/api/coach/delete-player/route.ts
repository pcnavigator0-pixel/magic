/**
 * Fully deletes a player: their portal_profiles row, their players row,
 * AND their Supabase Auth login (auth.users). The Auth Admin API is the
 * only way to remove an auth.users row, and it requires the SERVICE
 * ROLE key — which must never be sent to the browser. That's why this
 * has to be a server route rather than a direct client call.
 *
 * SECURITY: every request is re-verified server-side against the
 * is_coach() Postgres function using the CALLER's own access token,
 * before any service-role action runs. Without this check, the service
 * role key would let ANY authenticated user (including a player) delete
 * anyone's account — so do not remove or weaken this check.
 *
 * Order of deletion matters and must stay in this order to avoid
 * foreign-key violations regardless of how cascades are configured:
 *   1. portal_profiles row  (references both players.id and auth.users.id)
 *   2. players row
 *   3. auth.users row (via the Auth Admin API)
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization." }), { status: 401 });
    }

    const { playerId } = await request.json();
    if (!playerId) {
      return new Response(JSON.stringify({ error: "Missing playerId." }), { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      console.error("[Delete Player] Missing Supabase environment variables (is SUPABASE_SERVICE_ROLE_KEY set?)");
      return new Response(JSON.stringify({ error: "Server configuration error" }), { status: 500 });
    }

    // 1. Verify the caller is actually a coach, using THEIR OWN token —
    //    never trust the client, and never run the steps below without this.
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

    const serviceHeaders = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    };

    // 2. Look up the player so we know if they have a linked auth account.
    const playerRes = await fetch(
      `${supabaseUrl}/rest/v1/players?id=eq.${encodeURIComponent(playerId)}&select=id,auth_user_id`,
      { headers: serviceHeaders }
    );
    const players = await playerRes.json();
    const player = players?.[0];

    if (!player) {
      return new Response(JSON.stringify({ error: "Player not found." }), { status: 404 });
    }

    // 3. Delete the portal_profiles row first (clears both FK references).
    const profileDelete = await fetch(
      `${supabaseUrl}/rest/v1/portal_profiles?player_id=eq.${encodeURIComponent(playerId)}`,
      { method: "DELETE", headers: serviceHeaders }
    );
    if (!profileDelete.ok) {
      const detail = await profileDelete.text();
      console.error("[Delete Player] Failed to delete portal_profiles:", detail);
      return new Response(JSON.stringify({ error: "Failed to remove the player's portal profile." }), { status: 500 });
    }

    // 4. Delete the players row.
    const playerDelete = await fetch(
      `${supabaseUrl}/rest/v1/players?id=eq.${encodeURIComponent(playerId)}`,
      { method: "DELETE", headers: serviceHeaders }
    );
    if (!playerDelete.ok) {
      const detail = await playerDelete.text();
      console.error("[Delete Player] Failed to delete player:", detail);
      return new Response(JSON.stringify({ error: "Failed to remove the player record." }), { status: 500 });
    }

    // 5. Delete the Auth login itself, if one exists.
    if (player.auth_user_id) {
      const authDelete = await fetch(
        `${supabaseUrl}/auth/v1/admin/users/${player.auth_user_id}`,
        { method: "DELETE", headers: serviceHeaders }
      );
      if (!authDelete.ok && authDelete.status !== 404) {
        const detail = await authDelete.text();
        console.error("[Delete Player] Failed to delete auth user:", detail);
        return new Response(
          JSON.stringify({ error: "Player and profile were removed, but their login could not be deleted. Contact support." }),
          { status: 500 }
        );
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error("[Delete Player] Unexpected error:", error);
    return new Response(JSON.stringify({ error: "An unexpected error occurred." }), { status: 500 });
  }
}
