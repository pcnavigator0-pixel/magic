# Player Registration Fix — what's in this folder

## Order of operations

1. **Run the SQL first.** Open Supabase → SQL Editor → paste and run
   `supabase/registration-and-rls-fix.sql` in full. It's idempotent
   (safe to re-run — re-run it any time you pull a newer version of
   this file).
2. **Add your service role key.** In `.env.local` (and in Vercel's
   project environment variables for production), add:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```
   Get it from Supabase Dashboard → Project Settings → API →
   `service_role` secret. Never prefix it with `NEXT_PUBLIC_`. See the
   "deleting a registered player" section below for why it's needed.
3. **Then copy these 9 files** into your project at the same paths
   (overwrite the originals):
   - `lib/magic-data.ts`
   - `lib/portal-auth.ts`
   - `app/api/player-register/route.ts`
   - `app/api/coach/delete-player/route.ts` *(new file)*
   - `app/player-register/page.tsx`
   - `app/login/page.tsx`
   - `app/coach-dashboard/page.tsx`
   - `app/player-dashboard/page.tsx`
   - `app/player-profile/page.tsx`
4. Redeploy / restart `next dev`.

## What was actually wrong

**"Database error saving new user"** happens inside Supabase's own
`auth.signup` call, before any of your app code runs — so it's always
a broken **trigger on `auth.users`**. The SQL script finds and drops
any trigger there (this app doesn't need one; it creates the
`players`/`portal_profiles` rows explicitly via the new
`complete_player_registration()` function instead).

**The registration code leak on the public roster page** happened
because `/roster` calls `getMagicData()`, which queried
`players?select=*` with the anon key — i.e. it sent every column,
including `registration_code`, `email`, `auth_user_id`, and
`is_registered`, to every visitor's browser. Fixed by adding a
`players_public` view (safe columns only) that the public site now
reads from instead of the raw table.

**Anonymous inserts/updates on `players`** were possible because the
coach dashboard's `insertPlayer()` / `updatePlayer()` / `deletePlayer()`
calls were never passed the coach's session token, so every write
silently fell back to the anon key. RLS therefore *had* to allow anon
writes for the app to work at all. Fixed two ways: the coach dashboard
now passes `session.access_token` on every player write, and RLS on
`players` now requires the **coach role** for any insert/update/delete
— anon has no access to the table at all anymore.

**The registration flow itself** is now a single atomic step instead
of three separate fallible ones:
- `verify_registration_code(code)` — anon-callable, tells the player
  whether *their* code is valid without exposing anyone else's data.
- `complete_player_registration(...)` — callable only by an
  authenticated user completing *their own* registration
  (`auth.uid() = p_auth_user_id` is checked inside). In one
  transaction it updates the `players` row **and** creates the
  `portal_profiles` row. Either both happen or neither does — no more
  "account created but not linked" half-state.

There is still only one registration entry point: `/player-register`,
code-gated, exactly as you wanted. (Confirmed — no other signup form
exists in the codebase; I removed a small dead leftover field on the
login page that wasn't wired to anything.)

## One thing to verify yourself

Run this after applying the SQL, signed in as a coach, to confirm the
trigger is really gone:

```sql
select tgname from pg_trigger
where tgrelid = 'auth.users'::regclass and not tgisinternal;
```

It should return **zero rows**. If it still returns a row, that
trigger is your remaining blocker — paste me its name/definition and
I'll fix it specifically.

## New: deleting a registered player

Once a player has registered, they have a row in three places:
`players`, `portal_profiles`, and Supabase's own `auth.users` (their
login). Deleting just the `players` row used to fail with a foreign
key error, and even if forced through, would leave their login behind
forever.

`app/api/coach/delete-player/route.ts` is a new server-only route that
removes all three, in the safe order, after re-verifying the caller is
actually a coach. It needs your **service role key** as a server-side
environment variable — add this to `.env.local` (and to Vercel's
environment variables for production):

```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

Get it from Supabase Dashboard → Project Settings → API → `service_role` secret.

**Important:** this key must never be prefixed with `NEXT_PUBLIC_`,
never committed to git, and never referenced from any client-side
code — it bypasses all RLS. It's only read inside this one server
route, and that route checks `is_coach()` with the caller's own token
before doing anything with it.

## Not touched (flagged for a future pass, not in scope here)

`teams`, `events`, `matches`, `news_posts`, `shop_products`,
`media_assets`, and `site_content` weren't part of what you reported,
so I left their RLS alone. Worth a similar audit later if you want.
