-- A film can retain another platform as its primary source while also being
-- available on Circuits. Include either provenance signal in the queue.
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
      order by f.created_at desc
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
  order by f.created_at desc
  limit 10
  on conflict (platform, film_id) do nothing;
end;
$$;

revoke all on function public.refresh_platform_new_releases(text) from public;
grant execute on function public.refresh_platform_new_releases(text) to service_role;

select public.refresh_platform_new_releases('circuits');
