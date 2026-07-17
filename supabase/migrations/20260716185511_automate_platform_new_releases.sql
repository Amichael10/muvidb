-- Keep each streaming platform's New to Stream queue fresh while preserving
-- explicit admin ordering, additions, and removals.

create table if not exists public.platform_new_releases (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  film_id uuid not null references public.films(id) on delete cascade,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (platform, film_id)
);

alter table public.platform_new_releases
  add column if not exists entry_source text not null default 'manual',
  add column if not exists is_hidden boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'platform_new_releases_entry_source_check'
      and conrelid = 'public.platform_new_releases'::regclass
  ) then
    alter table public.platform_new_releases
      add constraint platform_new_releases_entry_source_check
      check (entry_source in ('auto', 'manual'));
  end if;
end
$$;

create index if not exists platform_new_releases_platform_visible_idx
  on public.platform_new_releases (platform, is_hidden, display_order, created_at desc);

create index if not exists films_source_created_at_idx
  on public.films (source, created_at desc);

alter table public.platform_new_releases enable row level security;

drop policy if exists "pnr_public_read" on public.platform_new_releases;
create policy "pnr_public_read" on public.platform_new_releases
  for select using (true);

drop policy if exists "pnr_admin_write" on public.platform_new_releases;
create policy "pnr_admin_write" on public.platform_new_releases
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

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

  -- Remove visible automatic rows that are no longer among the latest ten
  -- eligible sync records. Hidden rows are retained as admin exclusions.
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
          or (p_platform = 'circuits' and f.source = 'circuits')
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
      or (p_platform = 'circuits' and f.source = 'circuits')
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

create or replace function public.queue_synced_platform_release()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_platform text;
begin
  target_platform := case
    when new.source = 'netflix' then 'netflix'
    when new.source = 'prime_video' then 'prime_video'
    when new.source = 'kava' then 'kava'
    when new.source in ('docuth', 'docuth_sync') then 'docuth'
    when new.source = 'ebonylife' then 'ebonylife'
    when new.source = 'circuits' then 'circuits'
    else null
  end;

  if target_platform is not null then
    perform public.refresh_platform_new_releases(target_platform);
  end if;

  return new;
end;
$$;

revoke all on function public.queue_synced_platform_release() from public;

drop trigger if exists films_queue_synced_platform_release_insert on public.films;
create trigger films_queue_synced_platform_release_insert
after insert on public.films
for each row
execute function public.queue_synced_platform_release();

drop trigger if exists films_queue_synced_platform_release_source_update on public.films;
create trigger films_queue_synced_platform_release_source_update
after update of source on public.films
for each row
when (old.source is distinct from new.source)
execute function public.queue_synced_platform_release();

create or replace function public.refresh_platform_queue_after_hide()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_hidden = true and old.is_hidden is distinct from new.is_hidden then
    perform public.refresh_platform_new_releases(new.platform);
  end if;
  return new;
end;
$$;

revoke all on function public.refresh_platform_queue_after_hide() from public;

drop trigger if exists platform_new_releases_refresh_after_hide on public.platform_new_releases;
create trigger platform_new_releases_refresh_after_hide
after update of is_hidden on public.platform_new_releases
for each row
execute function public.refresh_platform_queue_after_hide();

select public.refresh_platform_new_releases('netflix');
select public.refresh_platform_new_releases('prime_video');
select public.refresh_platform_new_releases('kava');
select public.refresh_platform_new_releases('docuth');
select public.refresh_platform_new_releases('ebonylife');
select public.refresh_platform_new_releases('circuits');
