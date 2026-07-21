begin;

create or replace function public.is_coach()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.portal_profiles
    where id = auth.uid()
      and role = 'coach'
  );
$$;

create or replace function public.is_valid_news_content_blocks(value jsonb)
returns boolean
language sql
immutable
as $$
  select
    jsonb_typeof(value) = 'array'
    and not exists (
      select 1
      from jsonb_array_elements(value) as block(item)
      where not (
        (
          block.item->>'type' = 'paragraph'
          and jsonb_typeof(block.item->'text') = 'string'
        )
        or
        (
          block.item->>'type' = 'image'
          and jsonb_typeof(block.item->'url') = 'string'
          and block.item->>'align' in ('left', 'right')
          and (
            not (block.item ? 'caption')
            or block.item->'caption' = 'null'::jsonb
            or jsonb_typeof(block.item->'caption') = 'string'
          )
        )
      )
    );
$$;

alter table public.news_posts
  alter column content drop default;

alter table public.news_posts
  alter column content type jsonb
  using case
    when content is null or btrim(content) = '' then '[]'::jsonb
    else jsonb_build_array(jsonb_build_object('type', 'paragraph', 'text', content))
  end;

alter table public.news_posts
  alter column content set default '[]'::jsonb,
  alter column content set not null;

alter table public.news_posts
  drop constraint if exists news_posts_content_blocks_check;

alter table public.news_posts
  add constraint news_posts_content_blocks_check
  check (public.is_valid_news_content_blocks(content));

alter table public.news_posts enable row level security;

drop policy if exists "Public can read published news posts" on public.news_posts;
create policy "Public can read published news posts"
on public.news_posts
for select
using (is_published = true);

drop policy if exists "Coaches can read all news posts" on public.news_posts;
create policy "Coaches can read all news posts"
on public.news_posts
for select
to authenticated
using (public.is_coach());

drop policy if exists "Coaches can insert news posts" on public.news_posts;
create policy "Coaches can insert news posts"
on public.news_posts
for insert
to authenticated
with check (public.is_coach());

drop policy if exists "Coaches can update news posts" on public.news_posts;
create policy "Coaches can update news posts"
on public.news_posts
for update
to authenticated
using (public.is_coach())
with check (public.is_coach());

drop policy if exists "Coaches can delete news posts" on public.news_posts;
create policy "Coaches can delete news posts"
on public.news_posts
for delete
to authenticated
using (public.is_coach());

insert into storage.buckets (id, name, public)
values ('news-images', 'news-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public can read news images" on storage.objects;
create policy "Public can read news images"
on storage.objects
for select
using (bucket_id = 'news-images');

drop policy if exists "Coaches can upload news images" on storage.objects;
create policy "Coaches can upload news images"
on storage.objects
for insert
with check (bucket_id = 'news-images' and public.is_coach());

drop policy if exists "Coaches can update news images" on storage.objects;
create policy "Coaches can update news images"
on storage.objects
for update
using (bucket_id = 'news-images' and public.is_coach())
with check (bucket_id = 'news-images' and public.is_coach());

drop policy if exists "Coaches can delete news images" on storage.objects;
create policy "Coaches can delete news images"
on storage.objects
for delete
using (bucket_id = 'news-images' and public.is_coach());

commit;
