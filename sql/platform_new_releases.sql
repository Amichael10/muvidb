-- =============================================================================
-- PLATFORM "NEW RELEASES" — admin-curated
-- =============================================================================
-- Powers the homepage "New to Stream" tabbed rail. Because the catalogue is
-- still being backfilled, "new on <platform>" can't be reliably auto-detected,
-- so admins hand-pick which films appear under each platform tab from the films
-- we already have. The homepage shows the curated list when present and falls
-- back to recency otherwise. Depends on is_admin(). Safe to re-run.
--
-- Run once in the Supabase SQL editor.
-- =============================================================================

create table if not exists public.platform_new_releases (
  id            uuid primary key default gen_random_uuid(),
  platform      text not null,   -- 'netflix' | 'prime_video' | 'kava' | 'docuth'
  film_id       uuid not null references public.films(id) on delete cascade,
  display_order int not null default 0,
  created_at    timestamptz not null default now(),
  unique (platform, film_id)
);

create index if not exists idx_pnr_platform on public.platform_new_releases (platform, created_at desc);

alter table public.platform_new_releases enable row level security;

drop policy if exists "pnr_public_read" on public.platform_new_releases;
create policy "pnr_public_read" on public.platform_new_releases
  for select using (true);

drop policy if exists "pnr_admin_write" on public.platform_new_releases;
create policy "pnr_admin_write" on public.platform_new_releases
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
