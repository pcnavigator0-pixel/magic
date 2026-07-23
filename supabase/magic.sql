-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.site_content (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  section_key text NOT NULL UNIQUE,
  content jsonb NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT site_content_pkey PRIMARY KEY (id)
);
CREATE TABLE public.teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  city text,
  primary_color text NOT NULL DEFAULT '#E64A19'::text,
  is_home_team boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT teams_pkey PRIMARY KEY (id)
);
CREATE TABLE public.players (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  jersey_number integer NOT NULL CHECK (jersey_number >= 0 AND jersey_number <= 99),
  position text NOT NULL,
  height text,
  bio text,
  photo_url text,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'injured'::text, 'inactive'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  auth_user_id uuid,
  email text UNIQUE,
  registration_code text NOT NULL DEFAULT (gen_random_uuid())::text UNIQUE,
  is_registered boolean NOT NULL DEFAULT false,
  CONSTRAINT players_pkey PRIMARY KEY (id),
  CONSTRAINT players_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL,
  event_date date NOT NULL,
  event_time time without time zone,
  venue text NOT NULL,
  description text,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT events_pkey PRIMARY KEY (id)
);
CREATE TABLE public.matches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_date date NOT NULL,
  home_team_id uuid,
  away_team_id uuid,
  opponent_name text,
  home_score integer NOT NULL DEFAULT 0 CHECK (home_score >= 0),
  away_score integer NOT NULL DEFAULT 0 CHECK (away_score >= 0),
  venue text,
  league text NOT NULL DEFAULT 'Premier League'::text,
  mvp_player_id uuid,
  mvp_name text,
  status text NOT NULL DEFAULT 'final'::text CHECK (status = ANY (ARRAY['scheduled'::text, 'live'::text, 'final'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  match_time time without time zone,
  status_details text,
  current_quarter integer NOT NULL DEFAULT 1 CHECK (current_quarter >= 1 AND current_quarter <= 8),
  quarter_seconds_remaining integer NOT NULL DEFAULT 600 CHECK (quarter_seconds_remaining >= 0 AND quarter_seconds_remaining <= 720),
  clock_status text NOT NULL DEFAULT 'not_started'::text CHECK (clock_status = ANY (ARRAY['not_started'::text, 'running'::text, 'paused'::text, 'ended'::text])),
  clock_started_at timestamp with time zone,
  live_revision bigint NOT NULL DEFAULT 0,
  CONSTRAINT matches_pkey PRIMARY KEY (id),
  CONSTRAINT matches_home_team_id_fkey FOREIGN KEY (home_team_id) REFERENCES public.teams(id),
  CONSTRAINT matches_away_team_id_fkey FOREIGN KEY (away_team_id) REFERENCES public.teams(id),
  CONSTRAINT matches_mvp_player_id_fkey FOREIGN KEY (mvp_player_id) REFERENCES public.players(id)
);
CREATE TABLE public.news_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT 'Club'::text,
  excerpt text,
  content jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (is_valid_news_content_blocks(content)),
  image_url text,
  published_at timestamp with time zone NOT NULL DEFAULT now(),
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT news_posts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.coach_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  role text NOT NULL,
  club_name text NOT NULL DEFAULT 'MAGIC BBC'::text,
  email text,
  phone text,
  training_base text,
  bio text,
  avatar_url text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  auth_user_id uuid UNIQUE,
  CONSTRAINT coach_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT coach_profiles_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.media_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  asset_url text NOT NULL,
  asset_type text NOT NULL DEFAULT 'image'::text,
  alt_text text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT media_assets_pkey PRIMARY KEY (id)
);
CREATE TABLE public.portal_profiles (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['coach'::text, 'player'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  player_id uuid UNIQUE,
  CONSTRAINT portal_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT portal_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT portal_profiles_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id)
);
CREATE TABLE public.shop_products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT 'Merchandise'::text,
  description text,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  currency text NOT NULL DEFAULT 'RWF'::text,
  image_url text,
  inventory_count integer NOT NULL DEFAULT 0 CHECK (inventory_count >= 0),
  is_featured boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT shop_products_pkey PRIMARY KEY (id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  recipient_player_id uuid NOT NULL,
  sender_coach_id uuid,
  message text NOT NULL,
  duration_days integer NOT NULL DEFAULT 7,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_recipient_player_id_fkey FOREIGN KEY (recipient_player_id) REFERENCES public.players(id),
  CONSTRAINT notifications_sender_coach_id_fkey FOREIGN KEY (sender_coach_id) REFERENCES public.coach_profiles(id)
);
CREATE TABLE public.match_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['score'::text, 'clock'::text, 'status'::text, 'quarter'::text, 'note'::text])),
  team_side text CHECK (team_side = ANY (ARRAY['home'::text, 'away'::text])),
  points integer CHECK (points IS NULL OR (points = ANY (ARRAY[1, 2, 3]))),
  home_score integer NOT NULL CHECK (home_score >= 0),
  away_score integer NOT NULL CHECK (away_score >= 0),
  quarter integer NOT NULL CHECK (quarter >= 1 AND quarter <= 8),
  seconds_remaining integer NOT NULL CHECK (seconds_remaining >= 0 AND seconds_remaining <= 720),
  clock_status text NOT NULL CHECK (clock_status = ANY (ARRAY['not_started'::text, 'running'::text, 'paused'::text, 'ended'::text])),
  note text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT match_events_pkey PRIMARY KEY (id),
  CONSTRAINT match_events_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id),
  CONSTRAINT match_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);