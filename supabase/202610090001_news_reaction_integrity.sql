begin;

create table if not exists public.news_reactions (
  news_post_id uuid not null references public.news_posts(id) on delete cascade,
  visitor_id text not null check (char_length(visitor_id) between 16 and 128),
  reaction text not null check (reaction in ('like', 'dislike')),
  created_at timestamptz not null default now(),
  primary key (news_post_id, visitor_id)
);

create index if not exists news_reactions_post_reaction_idx
  on public.news_reactions (news_post_id, reaction);

alter table public.news_reactions enable row level security;

-- The old two-argument function could be called repeatedly without a visitor key.
drop function if exists public.react_to_news(uuid, text);

create or replace function public.react_to_news(post_id uuid, reaction text, voter_id text)
returns table(like_count bigint, dislike_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  if reaction not in ('like', 'dislike') then
    raise exception 'Invalid reaction';
  end if;
  if voter_id is null or char_length(voter_id) < 16 or char_length(voter_id) > 128 then
    raise exception 'Invalid visitor identity';
  end if;

  insert into public.news_reactions(news_post_id, visitor_id, reaction)
  select id, voter_id, reaction
  from public.news_posts
  where id = post_id and is_published = true
  on conflict (news_post_id, visitor_id) do nothing;

  get diagnostics inserted_count = row_count;

  if inserted_count > 0 then
    update public.news_posts
    set like_count = like_count + case when reaction = 'like' then 1 else 0 end,
        dislike_count = dislike_count + case when reaction = 'dislike' then 1 else 0 end,
        updated_at = now()
    where id = post_id and is_published = true;
  end if;

  return query
  select news_posts.like_count, news_posts.dislike_count
  from public.news_posts
  where news_posts.id = post_id and news_posts.is_published = true;
end;
$$;

grant execute on function public.react_to_news(uuid, text, text) to anon, authenticated;

commit;
