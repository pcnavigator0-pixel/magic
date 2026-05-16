create extension if not exists pgcrypto;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  city text,
  primary_color text not null default '#E64A19',
  is_home_team boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  jersey_number int not null check (jersey_number >= 0 and jersey_number <= 99),
  position text not null,
  height text,
  bio text,
  photo_url text,
  status text not null default 'active' check (status in ('active', 'injured', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  event_date date not null,
  event_time time,
  venue text not null,
  description text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  match_date date not null,
  home_team_id uuid references public.teams(id) on delete set null,
  away_team_id uuid references public.teams(id) on delete set null,
  opponent_name text,
  home_score int not null default 0 check (home_score >= 0),
  away_score int not null default 0 check (away_score >= 0),
  venue text,
  league text not null default 'Premier League',
  mvp_player_id uuid references public.players(id) on delete set null,
  mvp_name text,
  status text not null default 'final' check (status in ('scheduled', 'final')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.news_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  category text not null default 'Club',
  excerpt text,
  content text,
  image_url text,
  published_at timestamptz not null default now(),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  role text not null,
  club_name text not null default 'MAGIC BBC',
  email text,
  phone text,
  training_base text,
  bio text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  asset_url text not null,
  asset_type text not null default 'image',
  alt_text text,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists teams_set_updated_at on public.teams;
create trigger teams_set_updated_at before update on public.teams
for each row execute function public.set_updated_at();

drop trigger if exists players_set_updated_at on public.players;
create trigger players_set_updated_at before update on public.players
for each row execute function public.set_updated_at();

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at before update on public.events
for each row execute function public.set_updated_at();

drop trigger if exists matches_set_updated_at on public.matches;
create trigger matches_set_updated_at before update on public.matches
for each row execute function public.set_updated_at();

drop trigger if exists news_posts_set_updated_at on public.news_posts;
create trigger news_posts_set_updated_at before update on public.news_posts
for each row execute function public.set_updated_at();

alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.events enable row level security;
alter table public.matches enable row level security;
alter table public.news_posts enable row level security;
alter table public.coach_profiles enable row level security;
alter table public.media_assets enable row level security;

drop policy if exists "Public teams are readable" on public.teams;
create policy "Public teams are readable" on public.teams for select to anon using (true);
drop policy if exists "Dashboard can manage teams" on public.teams;
create policy "Dashboard can manage teams" on public.teams for all to anon using (true) with check (true);

drop policy if exists "Public players are readable" on public.players;
create policy "Public players are readable" on public.players for select to anon using (true);
drop policy if exists "Dashboard can manage players" on public.players;
create policy "Dashboard can manage players" on public.players for all to anon using (true) with check (true);

drop policy if exists "Public events are readable" on public.events;
create policy "Public events are readable" on public.events for select to anon using (is_published = true);
drop policy if exists "Dashboard can manage events" on public.events;
create policy "Dashboard can manage events" on public.events for all to anon using (true) with check (true);

drop policy if exists "Public matches are readable" on public.matches;
create policy "Public matches are readable" on public.matches for select to anon using (true);
drop policy if exists "Dashboard can manage matches" on public.matches;
create policy "Dashboard can manage matches" on public.matches for all to anon using (true) with check (true);

drop policy if exists "Public news is readable" on public.news_posts;
create policy "Public news is readable" on public.news_posts for select to anon using (is_published = true);
drop policy if exists "Dashboard can manage news" on public.news_posts;
create policy "Dashboard can manage news" on public.news_posts for all to anon using (true) with check (true);

drop policy if exists "Public coach profiles are readable" on public.coach_profiles;
create policy "Public coach profiles are readable" on public.coach_profiles for select to anon using (true);
drop policy if exists "Dashboard can manage coach profiles" on public.coach_profiles;
create policy "Dashboard can manage coach profiles" on public.coach_profiles for all to anon using (true) with check (true);

drop policy if exists "Public media is readable" on public.media_assets;
create policy "Public media is readable" on public.media_assets for select to anon using (true);
drop policy if exists "Dashboard can manage media" on public.media_assets;
create policy "Dashboard can manage media" on public.media_assets for all to anon using (true) with check (true);

insert into public.teams (name, slug, city, primary_color, is_home_team) values
('MAGIC BBC', 'magic-bbc', 'Kigali', '#E64A19', true),
('Kigali Titans', 'kigali-titans', 'Kigali', '#673AB7', false),
('Patriots BBC', 'patriots-bbc', 'Kigali', '#1976D2', false),
('REG BBC', 'reg-bbc', 'Kigali', '#388E3C', false),
('Espoir BBC', 'espoir-bbc', 'Kigali', '#D32F2F', false)
on conflict (slug) do update set
  name = excluded.name,
  city = excluded.city,
  primary_color = excluded.primary_color,
  is_home_team = excluded.is_home_team,
  updated_at = now();

insert into public.players (full_name, jersey_number, position, height, bio, photo_url, status) values
('Aiden Foster', 10, 'Captain', '6''4"', 'Floor leader with strong transition control and late-game poise.', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400', 'active'),
('Marcus Lawson', 9, 'Center', '6''9"', 'Interior anchor, rim protector, and high-efficiency finisher.', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400', 'active'),
('Caleb Reynolds', 2, 'Guard', '6''2"', 'Quick guard with strong perimeter pressure and pace control.', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=400', 'active'),
('Silas Grant', 3, 'Forward', '6''7"', 'Two-way wing who stretches the floor and attacks mismatches.', 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?q=80&w=400', 'active'),
('Elijah Thornton', 5, 'Guard', '6''1"', 'Reliable ball handler with sharp decision making.', 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?q=80&w=400', 'active')
on conflict do nothing;

insert into public.events (title, category, event_date, event_time, venue, description, is_published) values
('Eastern Conference Finals Warm-up', 'Premier League Match', '2026-05-19', '18:30', 'BK Arena, Court A', 'Final training and fan preview before the next league fixture.', true),
('MAGIC BBC Fan Meet', 'Fan Meet & Greet Session', '2026-05-23', '15:00', 'Kigali Arena Lobby', 'Meet the roster and coaching staff.', true)
on conflict do nothing;

insert into public.matches (match_date, opponent_name, home_score, away_score, venue, league, mvp_name, status) values
('2026-05-12', 'Kigali Titans', 140, 110, 'BK Arena', 'Premier League', 'Aiden Foster', 'final'),
('2026-05-08', 'Patriots BBC', 114, 106, 'Petit Stade', 'Premier League', 'Marcus Lawson', 'final'),
('2026-04-29', 'REG BBC', 98, 102, 'BK Arena', 'Premier League', 'Caleb Reynolds', 'final')
on conflict do nothing;

insert into public.news_posts (title, slug, category, excerpt, image_url, published_at, is_published) values
('Spotlight on famous basketball club rivalries', 'spotlight-basketball-club-rivalries', 'Clubs', 'A look at the fixtures and rivalries shaping MAGIC BBC momentum.', '/photos/FB_IMG_16641643860391113.jpg', '2026-05-12T10:00:00Z', true),
('5 moments that will take your breath away', 'five-magic-bbc-moments', 'Games', 'The plays, stops, and possessions fans are still talking about.', '/photos/FB_IMG_16619441995403998.jpg', '2026-05-10T10:00:00Z', true),
('All-time favorite basketball players and games', 'favorite-players-and-games', 'Roster', 'Stories from the roster and the games that shaped the club.', '/photos/471915143_8920672931352612_4027225711152469329_n.jpg', '2026-05-08T10:00:00Z', true)
on conflict (slug) do update set
  title = excluded.title,
  category = excluded.category,
  excerpt = excluded.excerpt,
  image_url = excluded.image_url,
  published_at = excluded.published_at,
  is_published = excluded.is_published,
  updated_at = now();

insert into public.coach_profiles (full_name, role, club_name, email, phone, training_base, bio, avatar_url) values
('Coach Alexander', 'Head Coach', 'MAGIC BBC', 'coach@magicbbc.com', '+250 788 000 000', 'Kigali, Rwanda', 'Focused on player development, disciplined defense, and fast transition basketball.', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=180')
on conflict do nothing;
