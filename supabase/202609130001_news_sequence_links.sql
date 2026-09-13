begin;

alter table public.news_posts
  add column if not exists previous_news_id uuid references public.news_posts(id) on delete set null,
  add column if not exists next_news_id uuid references public.news_posts(id) on delete set null;

alter table public.news_posts
  drop constraint if exists news_posts_no_self_sequence_link;

alter table public.news_posts
  add constraint news_posts_no_self_sequence_link
  check (
    (previous_news_id is null or previous_news_id <> id)
    and (next_news_id is null or next_news_id <> id)
  );

create index if not exists news_posts_previous_news_id_idx on public.news_posts(previous_news_id);
create index if not exists news_posts_next_news_id_idx on public.news_posts(next_news_id);

commit;
