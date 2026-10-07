begin;

create or replace function public.is_valid_news_content_blocks(value jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(value) = 'array'
    and not exists (
      select 1
      from jsonb_array_elements(value) as block(item)
      where not (
        (block.item->>'type' = 'paragraph'
          and jsonb_typeof(block.item->'text') = 'string'
          and (not (block.item ? 'align') or block.item->>'align' in ('left', 'center', 'right'))
          and (not (block.item ? 'size') or block.item->>'size' in ('small', 'medium', 'large'))
          and (not (block.item ? 'clear') or jsonb_typeof(block.item->'clear') = 'boolean')
          and (not (block.item ? 'related_match_ids') or jsonb_typeof(block.item->'related_match_ids') = 'array'))
        or (block.item->>'type' = 'heading'
          and jsonb_typeof(block.item->'text') = 'string'
          and block.item->>'level' in ('2', '3', '4'))
        or (block.item->>'type' in ('quote', 'pullquote')
          and jsonb_typeof(block.item->'text') = 'string'
          and (not (block.item ? 'citation') or block.item->'citation' = 'null'::jsonb or jsonb_typeof(block.item->'citation') = 'string'))
        or (block.item->>'type' = 'list'
          and jsonb_typeof(block.item->'ordered') = 'boolean'
          and jsonb_typeof(block.item->'items') = 'array'
          and not exists (select 1 from jsonb_array_elements(block.item->'items') as item(value) where not (jsonb_typeof(item.value) = 'string' or (jsonb_typeof(item.value) = 'object' and jsonb_typeof(item.value->'text') = 'string'))))
        or (block.item->>'type' = 'image'
          and jsonb_typeof(block.item->'url') = 'string'
          and block.item->>'align' in ('left', 'right', 'full')
          and (not (block.item ? 'width') or block.item->>'width' in ('small', 'medium', 'large'))
          and (not (block.item ? 'caption') or block.item->'caption' = 'null'::jsonb or jsonb_typeof(block.item->'caption') = 'string')
          and (not (block.item ? 'crop') or (jsonb_typeof(block.item->'crop') = 'object' and jsonb_typeof(block.item->'crop'->'zoom') = 'number' and jsonb_typeof(block.item->'crop'->'x') = 'number' and jsonb_typeof(block.item->'crop'->'y') = 'number')))
        or (block.item->>'type' = 'embed'
          and jsonb_typeof(block.item->'url') = 'string'
          and block.item->>'provider' in ('youtube', 'vimeo', 'social')
          and (not (block.item ? 'caption') or block.item->'caption' = 'null'::jsonb or jsonb_typeof(block.item->'caption') = 'string'))
        or (block.item->>'type' = 'table'
          and jsonb_typeof(block.item->'headers') = 'array'
          and jsonb_typeof(block.item->'rows') = 'array'
          and not exists (select 1 from jsonb_array_elements(block.item->'headers') as header(value) where jsonb_typeof(header.value) <> 'string')
          and not exists (select 1 from jsonb_array_elements(block.item->'rows') as row(value) where jsonb_typeof(row.value) <> 'array'))
      )
    );
$$;

alter table public.news_posts drop constraint if exists news_posts_content_blocks_check;
alter table public.news_posts add constraint news_posts_content_blocks_check check (public.is_valid_news_content_blocks(content));

commit;
