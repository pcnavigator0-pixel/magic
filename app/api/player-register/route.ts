/**
 * Completes player registration via the complete_player_registration()
 * Postgres function.
 *
 * IMPORTANT: this now forwards the caller's own Supabase access token
 * (set by lib/portal-auth.ts right after their auth account is created),
 * not the anon key. The database function checks that the token belongs
 * to the same user being registered (auth.uid() = p_auth_user_id) and
 * rejects anonymous calls outright — so a valid, matching bearer token
 * is required for this to succeed.
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization. Please sign up again." }),
        { status: 401 }
      );
    }

    const body = await request.json();
    const { registrationCode, fullName, email, authUserId } = body;

    if (!registrationCode || !fullName || !email || !authUserId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("[Player Register] Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500 }
      );
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/complete_player_registration`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        // Forward the player's own token — required by the function's
        // internal auth.uid() check.
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_registration_code: registrationCode,
        p_full_name: fullName,
        p_email: email,
        p_auth_user_id: authUserId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("[Player Register] Function error:", result);
      return new Response(
        JSON.stringify({ error: result.message || "Failed to complete player registration" }),
        { status: response.status }
      );
    }

    // The function returns a single JSON object (json_build_object), which
    // PostgREST may wrap in an array depending on the RPC call shape.
    const funcResult = Array.isArray(result) ? result[0] : result;

    if (!funcResult || !funcResult.success) {
      return new Response(
        JSON.stringify({ error: funcResult?.error || "Registration failed." }),
        { status: 400 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, player: funcResult.player }),
      { status: 200 }
    );
  } catch (error) {
    console.error("[Player Register] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
      { status: 500 }
    );
  }
}
