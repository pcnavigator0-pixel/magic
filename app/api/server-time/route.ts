const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET() {
  const supabaseTime = await getSupabaseTime();
  const serverTimeMs = supabaseTime ?? Date.now();

  return Response.json(
    {
      serverTimeMs,
      iso: new Date(serverTimeMs).toISOString(),
      source: supabaseTime ? "supabase" : "app-server",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

async function getSupabaseTime() {
  if (!supabaseUrl || !supabaseKey) return null;

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/events?select=id&limit=1`, {
      cache: "no-store",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    const dateHeader = response.headers.get("date");
    if (!dateHeader) return null;

    const timestamp = Date.parse(dateHeader);
    return Number.isFinite(timestamp) ? timestamp : null;
  } catch {
    return null;
  }
}
