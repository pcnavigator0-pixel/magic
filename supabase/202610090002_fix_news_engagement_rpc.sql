begin;

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
  select np.id, voter_id, reaction
  from public.news_posts as np
  where np.id = post_id and np.is_published = true
  on conflict (news_post_id, visitor_id) do nothing;

  get diagnostics inserted_count = row_count;

  if inserted_count > 0 then
    update public.news_posts as np
    set like_count = np.like_count + case when reaction = 'like' then 1 else 0 end,
        dislike_count = np.dislike_count + case when reaction = 'dislike' then 1 else 0 end,
        updated_at = now()
    where np.id = post_id and np.is_published = true;
  end if;

  return query
  select np.like_count, np.dislike_count
  from public.news_posts as np
  where np.id = post_id and np.is_published = true;
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
  select np.id, trimmed_author, trimmed_body
  from public.news_posts as np
  where np.id = post_id and np.is_published = true;

  return query
  update public.news_posts as np
  set comment_count = np.comment_count + 1,
      updated_at = now()
  where np.id = post_id and np.is_published = true
  returning np.comment_count;
end;
$$;

grant execute on function public.react_to_news(uuid, text, text) to anon, authenticated;
grant execute on function public.add_news_comment(uuid, text, text) to anon, authenticated;

commit;
