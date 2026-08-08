-- Background-removed portrait cut-outs for Social Studio actor cards.
--
-- Cards composite the subject over brand shapes, so they need a portrait with a
-- real alpha channel. Cut-outs are produced by Cloudinary's AI background
-- removal, which is a metered add-on, so the result is cached per person here
-- rather than being regenerated on every render.

alter table public.people
  add column if not exists photo_cutout_url text,
  add column if not exists photo_cutout_status text,
  add column if not exists photo_cutout_attempted_at timestamptz,
  add column if not exists photo_cutout_error text,
  add column if not exists photo_cutout_source_url text;

-- Null status means "never attempted". A row only becomes eligible again when
-- the source photo changes or a human rejects a bad cut-out.
alter table public.people
  drop constraint if exists people_photo_cutout_status_check;

alter table public.people
  add constraint people_photo_cutout_status_check
  check (photo_cutout_status is null or photo_cutout_status in ('pending', 'ready', 'failed', 'rejected'));

comment on column public.people.photo_cutout_url is
  'Public URL of the background-removed portrait, mirrored into Supabase storage.';
comment on column public.people.photo_cutout_status is
  'null = never attempted; pending | ready | failed | rejected.';
comment on column public.people.photo_cutout_source_url is
  'The photo_url the cut-out was generated from. When it no longer matches photo_url the cut-out is stale and should be regenerated.';
comment on column public.people.photo_cutout_error is
  'Last failure reason, for triaging the batch job.';

-- Drives the batch job: people who have a photo but no usable cut-out yet.
-- Partial so it stays small as the ready set grows.
create index if not exists people_photo_cutout_pending_idx
  on public.people (photo_cutout_attempted_at nulls first)
  where photo_url is not null
    and (photo_cutout_status is null or photo_cutout_status in ('pending', 'failed'));
