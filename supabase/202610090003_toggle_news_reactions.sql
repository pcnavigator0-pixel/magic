begin;

create or replace function public.react_to_news(post_id uuid, reaction text, voter_id text)
returns table(like_count bigint, dislike_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_reaction text;
  requested_reaction text := reaction;
begin
  if reaction not in ('like', 'dislike') then
    raise exception 'Invalid reaction';
  end if;
  if voter_id is null or char_length(voter_id) < 16 or char_length(voter_id) > 128 then
    raise exception 'Invalid visitor identity';
  end if;

  select nr.reaction into previous_reaction
  from public.news_reactions as nr
  where nr.news_post_id = post_id and nr.visitor_id = voter_id;

  if previous_reaction is null then
    insert into public.news_reactions(news_post_id, visitor_id, reaction)
    select np.id, voter_id, reaction
    from public.news_posts as np
    where np.id = post_id and np.is_published = true;

    update public.news_posts as np
    set like_count = np.like_count + case when reaction = 'like' then 1 else 0 end,
        dislike_count = np.dislike_count + case when reaction = 'dislike' then 1 else 0 end,
        updated_at = now()
    where np.id = post_id and np.is_published = true;
  elsif previous_reaction = reaction then
    delete from public.news_reactions as nr
    where nr.news_post_id = post_id and nr.visitor_id = voter_id;

    update public.news_posts as np
    set like_count = greatest(0, np.like_count - case when reaction = 'like' then 1 else 0 end),
        dislike_count = greatest(0, np.dislike_count - case when reaction = 'dislike' then 1 else 0 end),
        updated_at = now()
    where np.id = post_id and np.is_published = true;
  else
    update public.news_reactions as nr
    set reaction = requested_reaction,
        created_at = now()
    where nr.news_post_id = post_id and nr.visitor_id = voter_id;

    update public.news_posts as np
    set like_count = greatest(0, np.like_count - case when previous_reaction = 'like' then 1 else 0 end)
      + case when reaction = 'like' then 1 else 0 end,
        dislike_count = greatest(0, np.dislike_count - case when previous_reaction = 'dislike' then 1 else 0 end)
      + case when reaction = 'dislike' then 1 else 0 end,
        updated_at = now()
    where np.id = post_id and np.is_published = true;
  end if;

  return query
  select np.like_count, np.dislike_count
  from public.news_posts as np
  where np.id = post_id and np.is_published = true;
end;
$$;

grant execute on function public.react_to_news(uuid, text, text) to anon, authenticated;

commit;
