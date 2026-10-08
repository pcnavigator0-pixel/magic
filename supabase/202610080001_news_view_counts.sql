begin;

alter table public.news_posts
  add column if not exists view_count bigint not null default 0
  check (view_count >= 0);

create or replace function public.increment_news_view(post_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count bigint;
begin
  update public.news_posts
  set view_count = view_count + 1,
      updated_at = now()
  where id = post_id
    and is_published = true
  returning view_count into next_count;

  return coalesce(next_count, 0);
end;
$$;

grant execute on function public.increment_news_view(uuid) to anon, authenticated;

commit;
