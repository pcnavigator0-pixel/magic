begin;

alter table public.news_posts
  add column if not exists like_count bigint not null default 0 check (like_count >= 0),
  add column if not exists dislike_count bigint not null default 0 check (dislike_count >= 0),
  add column if not exists comment_count bigint not null default 0 check (comment_count >= 0);

create table if not exists public.news_comments (
  id uuid primary key default gen_random_uuid(),
  news_post_id uuid not null references public.news_posts(id) on delete cascade,
  author_name text not null check (char_length(trim(author_name)) between 1 and 80),
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  is_approved boolean not null default true
);

create index if not exists news_comments_post_created_idx
  on public.news_comments (news_post_id, created_at desc);

alter table public.news_comments enable row level security;

create or replace function public.react_to_news(post_id uuid, reaction text)
returns table(like_count bigint, dislike_count bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if reaction not in ('like', 'dislike') then
    raise exception 'Invalid reaction';
  end if;

  return query
  update public.news_posts
  set like_count = like_count + case when reaction = 'like' then 1 else 0 end,
      dislike_count = dislike_count + case when reaction = 'dislike' then 1 else 0 end,
      updated_at = now()
  where id = post_id and is_published = true
  returning news_posts.like_count, news_posts.dislike_count;
end;
$$;

create or replace function public.add_news_comment(post_id uuid, comment_author text, comment_body text)
returns table(comment_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  trimmed_author text := trim(comment_author);
  trimmed_body text := trim(comment_body);
begin
  if char_length(trimmed_author) < 1 or char_length(trimmed_author) > 80 then
    raise exception 'Name must be between 1 and 80 characters';
  end if;
  if char_length(trimmed_body) < 1 or char_length(trimmed_body) > 1000 then
    raise exception 'Comment must be between 1 and 1000 characters';
  end if;

  insert into public.news_comments(news_post_id, author_name, body)
  select id, trimmed_author, trimmed_body
  from public.news_posts
  where id = post_id and is_published = true;

  return query
  update public.news_posts
  set comment_count = comment_count + 1,
      updated_at = now()
  where id = post_id and is_published = true
  returning news_posts.comment_count;
end;
$$;

grant execute on function public.react_to_news(uuid, text) to anon, authenticated;
grant execute on function public.add_news_comment(uuid, text, text) to anon, authenticated;

grant select on public.news_comments to anon, authenticated;
create policy "Anyone can read approved news comments"
  on public.news_comments for select
  using (is_approved = true);

commit;
