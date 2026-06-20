-- =====================================================================
-- Magic Initiative Rwanda — Registration error fix + RLS lockdown
-- Run this whole file once in the Supabase SQL Editor (it's idempotent,
-- safe to re-run). Read the comments before running if you want to
-- understand each step.
-- =====================================================================


-- ---------------------------------------------------------------------
-- STEP 1: Remove whatever trigger on auth.users is causing
-- "Database error saving new user".
--
-- This app creates the players/portal_profiles rows itself, explicitly,
-- via the RPC function below — it does NOT need a trigger on auth.users.
-- A leftover/broken trigger (very commonly a "handle_new_user" trigger
-- copied from a different starter template) is the #1 cause of this
-- exact error message, because it runs INSIDE the same transaction as
-- the auth.users insert and aborts the whole signup if it fails.
-- ---------------------------------------------------------------------
do $$
declare
  trig record;
begin
  for trig in
    select tgname
    from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and not tgisinternal
  loop
    raise notice 'Dropping trigger % on auth.users', trig.tgname;
    execute format('drop trigger if exists %I on auth.users', trig.tgname);
  end loop;
end $$;

-- Clean up a commonly-named leftover function too, if present.
drop function if exists public.handle_new_user();


-- ---------------------------------------------------------------------
-- STEP 2: Helper function to check "is this user a coach" without
-- causing RLS recursion (used inside policies below).
-- ---------------------------------------------------------------------
create or replace function public.is_coach()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.portal_profiles
    where id = auth.uid() and role = 'coach'
  );
$$;

grant execute on function public.is_coach() to authenticated;


-- ---------------------------------------------------------------------
-- STEP 3: Public-safe view of players for the public roster page.
-- Excludes registration_code, email, auth_user_id, is_registered —
-- this is what was leaking on /roster before.
-- ---------------------------------------------------------------------
create or replace view public.players_public as
select
  id,
  full_name,
  jersey_number,
  position,
  height,
  bio,
  photo_url,
  status,
  created_at,
  updated_at
from public.players;

grant select on public.players_public to anon, authenticated;


-- ---------------------------------------------------------------------
-- STEP 4: Lock down the real `players` table.
-- - No anonymous access at all (the public roster uses players_public).
-- - Authenticated players can see only their own row.
-- - Coaches can see/edit everything.
-- - Inserts/updates/deletes require the coach role (the registration
--   RPC below bypasses this safely via SECURITY DEFINER, after its own
--   internal validation).
-- ---------------------------------------------------------------------
revoke all on public.players from anon;
alter table public.players enable row level security;

drop policy if exists "players_select" on public.players;
create policy "players_select"
on public.players for select
to authenticated
using (
  is_coach() or auth_user_id = auth.uid()
);

drop policy if exists "players_coach_write" on public.players;
create policy "players_coach_write"
on public.players for all
to authenticated
using (is_coach())
with check (is_coach());


-- ---------------------------------------------------------------------
-- STEP 5: Lock down portal_profiles.
-- - No anonymous access.
-- - A user can see their own profile; coaches can see all.
-- - No direct insert/update/delete policy for anyone — profile rows
--   are only ever created by the complete_player_registration() RPC
--   below (SECURITY DEFINER), which validates everything first.
-- ---------------------------------------------------------------------
revoke all on public.portal_profiles from anon;
alter table public.portal_profiles enable row level security;

drop policy if exists "portal_profiles_select" on public.portal_profiles;
create policy "portal_profiles_select"
on public.portal_profiles for select
to authenticated
using (
  id = auth.uid() or is_coach()
);


-- ---------------------------------------------------------------------
-- STEP 6: Lock down notifications (each player should only see their
-- own messages — right now this is filtered client-side only, which
-- means every player's browser actually downloads every player's
-- notifications).
-- ---------------------------------------------------------------------
revoke all on public.notifications from anon;
alter table public.notifications enable row level security;

drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select"
on public.notifications for select
to authenticated
using (
  is_coach()
  or recipient_player_id in (
    select id from public.players where auth_user_id = auth.uid()
  )
);

drop policy if exists "notifications_coach_write" on public.notifications;
create policy "notifications_coach_write"
on public.notifications for all
to authenticated
using (is_coach())
with check (is_coach());


-- ---------------------------------------------------------------------
-- STEP 7: coach_profiles — public read (it's shown on the public site),
-- coach-only write.
-- ---------------------------------------------------------------------
alter table public.coach_profiles enable row level security;

drop policy if exists "coach_profiles_public_read" on public.coach_profiles;
create policy "coach_profiles_public_read"
on public.coach_profiles for select
to anon, authenticated
using (true);

drop policy if exists "coach_profiles_coach_write" on public.coach_profiles;
create policy "coach_profiles_coach_write"
on public.coach_profiles for all
to authenticated
using (is_coach())
with check (is_coach());


-- ---------------------------------------------------------------------
-- STEP 8: verify_registration_code(code)
-- Anonymous-callable. Tells the player whether THEIR OWN code is valid,
-- and what they're assigned as — without exposing anyone else's data
-- (registration_code, email, auth_user_id, is_registered are never
-- returned by this function).
-- ---------------------------------------------------------------------
drop function if exists public.verify_registration_code(text);

create or replace function public.verify_registration_code(p_code text)
returns table (
  status text,
  player_id uuid,
  full_name text,
  jersey_number integer,
  "position" text,
  height text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  -- NOTE: these are deliberately prefixed with v_ and kept separate from
  -- the RETURNS TABLE column names above. RETURNS TABLE implicitly creates
  -- variables named status/player_id/full_name/jersey_number/position/height
  -- inside this function body — reusing those exact names for a record or
  -- for "select x into ..." causes a "column reference is ambiguous" error,
  -- because Postgres can't tell if you mean the table column or the OUT
  -- parameter of the same name.
  v_id uuid;
  v_full_name text;
  v_jersey_number integer;
  v_position text;
  v_height text;
  v_is_registered boolean;
begin
  select p.id, p.full_name, p.jersey_number, p.position, p.height, p.is_registered
  into v_id, v_full_name, v_jersey_number, v_position, v_height, v_is_registered
  from public.players p
  where lower(p.registration_code) = lower(trim(p_code))
  limit 1;

  if v_id is null then
    return query select 'not_found'::text, null::uuid, null::text, null::integer, null::text, null::text;
    return;
  end if;

  if v_is_registered then
    return query select 'already_used'::text, null::uuid, null::text, null::integer, null::text, null::text;
    return;
  end if;

  return query
    select 'ok'::text, v_id, v_full_name, v_jersey_number, v_position, v_height;
end;
$$;

grant execute on function public.verify_registration_code(text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- STEP 9: complete_player_registration(...)
-- The ONE place that finishes a player's registration. Replaces the
-- old version. Runs as a single atomic transaction:
--   1. Re-validates the code (race-safe via row lock)
--   2. Updates the players row (real name, email, auth_user_id, flips
--      is_registered to true)
--   3. Creates the matching portal_profiles row
-- Both writes succeed together or both roll back together — no more
-- "account created but not linked" half-finished state.
--
-- SECURITY: only callable by an authenticated user, and only to
-- register THEMSELVES (auth.uid() must match p_auth_user_id). This
-- also means it can no longer be called with just the anon key.
-- ---------------------------------------------------------------------
drop function if exists public.complete_player_registration(text, text, text, uuid);

create or replace function public.complete_player_registration(
  p_registration_code text,
  p_full_name text,
  p_email text,
  p_auth_user_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
  v_is_registered boolean;
begin
  if auth.uid() is null or auth.uid() <> p_auth_user_id then
    return json_build_object('success', false, 'error', 'Not authorized to complete this registration.');
  end if;

  -- Lock the row so two simultaneous attempts on the same code can't both succeed.
  select id, is_registered
  into v_player_id, v_is_registered
  from public.players
  where lower(registration_code) = lower(trim(p_registration_code))
  for update;

  if v_player_id is null then
    return json_build_object(
      'success', false,
      'error', 'Code "' || p_registration_code || '" not found. Please check it and try again.'
    );
  end if;

  if v_is_registered then
    return json_build_object(
      'success', false,
      'error', 'This registration code has already been used. Contact your coach for a new code.'
    );
  end if;

  if exists (select 1 from public.players where auth_user_id = p_auth_user_id) then
    return json_build_object('success', false, 'error', 'This account is already linked to a player profile.');
  end if;

  if exists (select 1 from public.portal_profiles where id = p_auth_user_id) then
    return json_build_object('success', false, 'error', 'A portal account already exists for this user.');
  end if;

  update public.players
  set full_name = p_full_name,
      email = p_email,
      auth_user_id = p_auth_user_id,
      is_registered = true,
      updated_at = now()
  where id = v_player_id;

  insert into public.portal_profiles (id, email, full_name, role, player_id)
  values (p_auth_user_id, p_email, p_full_name, 'player', v_player_id);

  return json_build_object(
    'success', true,
    'player', json_build_object(
      'id', v_player_id,
      'full_name', p_full_name,
      'email', p_email,
      'is_registered', true,
      'auth_user_id', p_auth_user_id
    )
  );
exception
  when unique_violation then
    return json_build_object('success', false, 'error', 'This email or account is already registered.');
end;
$$;

revoke all on function public.complete_player_registration(text, text, text, uuid) from public;
grant execute on function public.complete_player_registration(text, text, text, uuid) to authenticated;


-- ---------------------------------------------------------------------
-- DONE. Quick sanity checks you can run after this:
-- ---------------------------------------------------------------------
-- select tgname from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal;
--   -> should return 0 rows
--
-- select * from public.players_public limit 5;
--   -> should show players WITHOUT registration_code/email/auth_user_id/is_registered
--
-- select proname from pg_proc where proname in ('verify_registration_code','complete_player_registration','is_coach');
--   -> should return all three
