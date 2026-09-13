begin;

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
          and (not (block.item ? 'align') or block.item->>'align' in ('left', 'center', 'right'))
          and (not (block.item ? 'weight') or block.item->>'weight' in ('normal', 'bold'))
          and (not (block.item ? 'size') or block.item->>'size' in ('small', 'medium', 'large'))
          and (not (block.item ? 'clear') or jsonb_typeof(block.item->'clear') = 'boolean')
        )
        or
        (
          block.item->>'type' = 'image'
          and jsonb_typeof(block.item->'url') = 'string'
          and block.item->>'align' in ('left', 'right', 'full')
          and (not (block.item ? 'width') or block.item->>'width' in ('small', 'medium', 'large'))
          and (not (block.item ? 'caption') or block.item->'caption' = 'null'::jsonb or jsonb_typeof(block.item->'caption') = 'string')
        )
      )
    );
$$;

alter table public.news_posts
  drop constraint if exists news_posts_content_blocks_check;

alter table public.news_posts
  add constraint news_posts_content_blocks_check
  check (public.is_valid_news_content_blocks(content));

commit;
