-- Expose films only when they have been admitted to the public New to Stream
-- queue. This keeps the films table's review-oriented RLS rules intact while
-- allowing newly synced queue entries to render for anonymous visitors.

create or replace function public.get_platform_new_releases(
  p_platforms text[] default null
)
returns table (
  platform text,
  display_order integer,
  queue_created_at timestamptz,
  entry_source text,
  film jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pnr.platform,
    pnr.display_order,
    pnr.created_at as queue_created_at,
    pnr.entry_source,
    to_jsonb(f) || jsonb_build_object(
      'genres',
      coalesce(
        (
          select jsonb_agg(g.name order by g.name)
          from public.film_genres fg
          join public.genres g on g.id = fg.genre_id
          where fg.film_id = f.id
        ),
        to_jsonb(coalesce(f.genres, array[]::text[]))
      )
    ) as film
  from public.platform_new_releases pnr
  join public.films f on f.id = pnr.film_id
  where pnr.is_hidden = false
    and (p_platforms is null or pnr.platform = any(p_platforms))
  order by
    pnr.platform,
    pnr.display_order,
    f.created_at desc,
    pnr.created_at desc;
$$;

revoke all on function public.get_platform_new_releases(text[]) from public;
grant execute on function public.get_platform_new_releases(text[]) to anon, authenticated;
