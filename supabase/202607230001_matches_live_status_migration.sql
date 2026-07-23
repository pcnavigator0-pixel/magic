-- Adds scheduled/final/live match control fields and an event log for live updates.

CREATE OR REPLACE FUNCTION public.is_coach()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.portal_profiles
    WHERE id = auth.uid()
      AND role = 'coach'
  );
$$;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS home_team_id uuid,
  ADD COLUMN IF NOT EXISTS away_team_id uuid,
  ADD COLUMN IF NOT EXISTS match_time time without time zone,
  ADD COLUMN IF NOT EXISTS status_details text,
  ADD COLUMN IF NOT EXISTS current_quarter integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS quarter_seconds_remaining integer NOT NULL DEFAULT 600,
  ADD COLUMN IF NOT EXISTS clock_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS clock_started_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS live_revision bigint NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.matches'::regclass
      AND conname = 'matches_home_team_id_fkey'
  ) THEN
    ALTER TABLE public.matches
      ADD CONSTRAINT matches_home_team_id_fkey FOREIGN KEY (home_team_id) REFERENCES public.teams(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.matches'::regclass
      AND conname = 'matches_away_team_id_fkey'
  ) THEN
    ALTER TABLE public.matches
      ADD CONSTRAINT matches_away_team_id_fkey FOREIGN KEY (away_team_id) REFERENCES public.teams(id);
  END IF;
END $$;

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.matches'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%'
    AND pg_get_constraintdef(oid) LIKE '%scheduled%'
    AND pg_get_constraintdef(oid) LIKE '%final%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.matches DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_status_check,
  DROP CONSTRAINT IF EXISTS matches_current_quarter_check,
  DROP CONSTRAINT IF EXISTS matches_quarter_seconds_remaining_check,
  DROP CONSTRAINT IF EXISTS matches_clock_status_check;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_status_check CHECK (status = ANY (ARRAY['scheduled'::text, 'live'::text, 'final'::text, 'canceled'::text])),
  ADD CONSTRAINT matches_current_quarter_check CHECK (current_quarter >= 1 AND current_quarter <= 8),
  ADD CONSTRAINT matches_quarter_seconds_remaining_check CHECK (quarter_seconds_remaining >= 0 AND quarter_seconds_remaining <= 720),
  ADD CONSTRAINT matches_clock_status_check CHECK (clock_status = ANY (ARRAY['not_started'::text, 'running'::text, 'paused'::text, 'ended'::text]));

CREATE TABLE IF NOT EXISTS public.match_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['score'::text, 'clock'::text, 'status'::text, 'quarter'::text, 'note'::text])),
  team_side text CHECK (team_side = ANY (ARRAY['home'::text, 'away'::text])),
  points integer CHECK (points IS NULL OR points = ANY (ARRAY[1, 2, 3])),
  home_score integer NOT NULL CHECK (home_score >= 0),
  away_score integer NOT NULL CHECK (away_score >= 0),
  quarter integer NOT NULL CHECK (quarter >= 1 AND quarter <= 8),
  seconds_remaining integer NOT NULL CHECK (seconds_remaining >= 0 AND seconds_remaining <= 720),
  clock_status text NOT NULL CHECK (clock_status = ANY (ARRAY['not_started'::text, 'running'::text, 'paused'::text, 'ended'::text])),
  note text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT match_events_pkey PRIMARY KEY (id),
  CONSTRAINT match_events_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE,
  CONSTRAINT match_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS match_events_match_id_created_at_idx
  ON public.match_events(match_id, created_at DESC);

CREATE INDEX IF NOT EXISTS matches_status_match_date_idx
  ON public.matches(status, match_date DESC);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read matches" ON public.matches;
DROP POLICY IF EXISTS "Coaches can insert matches" ON public.matches;
DROP POLICY IF EXISTS "Coaches can update matches" ON public.matches;
DROP POLICY IF EXISTS "Coaches can delete matches" ON public.matches;
DROP POLICY IF EXISTS "Public can read match events" ON public.match_events;
DROP POLICY IF EXISTS "Coaches can insert match events" ON public.match_events;
DROP POLICY IF EXISTS "Coaches can update match events" ON public.match_events;
DROP POLICY IF EXISTS "Coaches can delete match events" ON public.match_events;

CREATE POLICY "Public can read matches"
ON public.matches FOR SELECT
USING (true);

CREATE POLICY "Coaches can insert matches"
ON public.matches FOR INSERT
WITH CHECK (public.is_coach());

CREATE POLICY "Coaches can update matches"
ON public.matches FOR UPDATE
USING (public.is_coach())
WITH CHECK (public.is_coach());

CREATE POLICY "Coaches can delete matches"
ON public.matches FOR DELETE
USING (public.is_coach());

CREATE POLICY "Public can read match events"
ON public.match_events FOR SELECT
USING (true);

CREATE POLICY "Coaches can insert match events"
ON public.match_events FOR INSERT
WITH CHECK (public.is_coach());

CREATE POLICY "Coaches can update match events"
ON public.match_events FOR UPDATE
USING (public.is_coach())
WITH CHECK (public.is_coach());

CREATE POLICY "Coaches can delete match events"
ON public.match_events FOR DELETE
USING (public.is_coach());
