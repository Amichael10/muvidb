-- Remap the legacy MPAA value PG-13 onto the official NFVCB scale.
--
-- PG-13 is an American rating and was never part of the Nigerian set. The
-- Board's nearest equivalents are '12' (a hard age bar) and '12A' (advisory).
-- '12' was chosen.
--
-- The affected ids are captured first. Once these rows read '12' there is no
-- way to tell them apart from films genuinely classified 12, so reversing this
-- without a record would be impossible. Mirrors the existing
-- credits_role_cleanup_backup convention.
--
-- This does not remove 'PG-13' from the enum — Postgres cannot drop an enum
-- value in place — but after this migration no row uses it.

create table if not exists public.films_pg13_remap_backup (
  film_id uuid primary key,
  previous_rating text not null,
  remapped_to text not null,
  remapped_at timestamptz not null default now()
);

alter table public.films_pg13_remap_backup enable row level security;

drop policy if exists films_pg13_remap_backup_admin_read on public.films_pg13_remap_backup;
create policy films_pg13_remap_backup_admin_read
  on public.films_pg13_remap_backup
  for select
  using (public.is_admin());

insert into public.films_pg13_remap_backup (film_id, previous_rating, remapped_to)
select id, 'PG-13', '12'
from public.films
where nfvcb_rating = 'PG-13'
on conflict (film_id) do nothing;

update public.films
set nfvcb_rating = '12'
where nfvcb_rating = 'PG-13';
