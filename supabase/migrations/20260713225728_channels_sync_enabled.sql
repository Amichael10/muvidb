-- Add sync_enabled to channels so an admin can pause a channel from the daily
-- video sync (runVideosSync). Existing channels default to enabled so behaviour
-- is unchanged until a channel is explicitly toggled off.
alter table public.channels
  add column if not exists sync_enabled boolean not null default true;
