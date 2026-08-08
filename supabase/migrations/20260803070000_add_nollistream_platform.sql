-- NolliStream: first-party Nollywood streaming platform.
-- Allow release_type/source and include in platform new-releases queue.

alter table public.films
  drop constraint if exists films_release_type_check;

alter table public.films
  add constraint films_release_type_check check (
    release_type in (
      'cinema',
      'youtube',
      'netflix',
      'prime_video',
      'kava',
      'showmax',
      'unreleased',
      'apple_tv',
      'disney_plus',
      'hulu',
      'irokotv',
      'youtube_premium',
      'docuth',
      'ebonylife',
      'circuits',
      'nollistream'
    )
  );

create or replace function public.refresh_platform_new_releases(p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_platform not in ('netflix', 'prime_video', 'kava', 'docuth', 'ebonylife', 'circuits', 'nollistream') then
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
          or (
            p_platform = 'nollistream'
            and (f.source = 'nollistream' or coalesce(f.streaming_links, '{}'::jsonb) ? 'nollistream')
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
        case when p_platform in ('circuits', 'nollistream') then f.updated_at else f.created_at end desc
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
      or (
        p_platform = 'nollistream'
        and (f.source = 'nollistream' or coalesce(f.streaming_links, '{}'::jsonb) ? 'nollistream')
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
    case when p_platform in ('circuits', 'nollistream') then f.updated_at else f.created_at end desc
  limit 10
  on conflict (platform, film_id) do nothing;
end;
$$;

select public.refresh_platform_new_releases('nollistream');
