-- The Circuits adapter processes source entries oldest-to-newest. Existing
-- films therefore use updated_at to preserve the platform's source order.
create or replace function public.refresh_platform_new_releases(p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_platform not in ('netflix', 'prime_video', 'kava', 'docuth', 'ebonylife', 'circuits') then
    return;
  end if;

  delete from public.platform_new_releases pnr
  where pnr.platform = p_platform
    and pnr.entry_source = 'auto'
    and pnr.is_hidden = false
    and pnr.film_id not in (
      select f.id
      from public.films f
      where nullif(btrim(f.title), '') is not null
        and (
          (p_platform = 'netflix' and f.source = 'netflix')
          or (p_platform = 'prime_video' and f.source = 'prime_video')
          or (p_platform = 'kava' and f.source = 'kava')
          or (p_platform = 'docuth' and f.source in ('docuth', 'docuth_sync'))
          or (p_platform = 'ebonylife' and f.source = 'ebonylife')
          or (
            p_platform = 'circuits'
            and (f.source = 'circuits' or coalesce(f.streaming_links, '{}'::jsonb) ? 'circuits')
          )
        )
        and not exists (
          select 1
          from public.platform_new_releases hidden
          where hidden.platform = p_platform
            and hidden.film_id = f.id
            and hidden.is_hidden = true
        )
      order by
        case when p_platform = 'circuits' then f.updated_at else f.created_at end desc
      limit 10
    );

  insert into public.platform_new_releases (
    platform,
    film_id,
    display_order,
    entry_source,
    is_hidden
  )
  select
    p_platform,
    f.id,
    -1,
    'auto',
    false
  from public.films f
  where nullif(btrim(f.title), '') is not null
    and (
      (p_platform = 'netflix' and f.source = 'netflix')
      or (p_platform = 'prime_video' and f.source = 'prime_video')
      or (p_platform = 'kava' and f.source = 'kava')
      or (p_platform = 'docuth' and f.source in ('docuth', 'docuth_sync'))
      or (p_platform = 'ebonylife' and f.source = 'ebonylife')
      or (
        p_platform = 'circuits'
        and (f.source = 'circuits' or coalesce(f.streaming_links, '{}'::jsonb) ? 'circuits')
      )
    )
    and not exists (
      select 1
      from public.platform_new_releases hidden
      where hidden.platform = p_platform
        and hidden.film_id = f.id
        and hidden.is_hidden = true
    )
  order by
    case when p_platform = 'circuits' then f.updated_at else f.created_at end desc
  limit 10
  on conflict (platform, film_id) do nothing;
end;
$$;

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
    case when pnr.platform = 'circuits' then f.updated_at else f.created_at end desc,
    pnr.created_at desc;
$$;

revoke all on function public.get_platform_new_releases(text[]) from public;
grant execute on function public.get_platform_new_releases(text[]) to anon, authenticated;

select public.refresh_platform_new_releases('circuits');
