-- Social Studio foundation: additive schema, RLS, storage bucket, and seed templates.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'social_platform') then
    create type public.social_platform as enum ('instagram', 'facebook', 'threads', 'tiktok');
  end if;

  if not exists (select 1 from pg_type where typname = 'social_connection_status') then
    create type public.social_connection_status as enum ('pending', 'connected', 'expired', 'revoked', 'error');
  end if;

  if not exists (select 1 from pg_type where typname = 'social_content_status') then
    create type public.social_content_status as enum (
      'generating',
      'draft',
      'ready_for_review',
      'approved',
      'scheduled',
      'publishing',
      'partially_published',
      'published',
      'failed',
      'rejected',
      'archived'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'social_asset_format') then
    create type public.social_asset_format as enum (
      'portrait_4_5',
      'square_1_1',
      'vertical_9_16',
      'landscape_16_9',
      'video_vertical_9_16'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'social_variant_status') then
    create type public.social_variant_status as enum (
      'draft',
      'approved',
      'scheduled',
      'publishing',
      'published',
      'uploaded_as_draft',
      'failed',
      'skipped'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'social_job_status') then
    create type public.social_job_status as enum (
      'queued',
      'processing',
      'retrying',
      'succeeded',
      'failed',
      'dead_letter',
      'cancelled'
    );
  end if;
end $$;

create or replace function public.is_social_studio_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and role = 'admin'::public.user_role
  );
$$;

create table if not exists public.social_connections (
  id uuid primary key default gen_random_uuid(),
  platform public.social_platform not null,
  display_name text,
  username text,
  external_account_id text not null,
  external_parent_id text,
  profile_image_url text,
  status public.social_connection_status not null default 'pending',
  granted_scopes text[] not null default '{}',
  token_secret_id uuid,
  token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  last_verified_at timestamptz,
  connection_metadata jsonb not null default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(platform, external_account_id)
);

create table if not exists public.social_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  content_type text not null,
  version integer not null default 1,
  template_config jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.social_content_items (
  id uuid primary key default gen_random_uuid(),
  content_type text not null,
  title text not null,
  source_entity_type text not null,
  source_entity_id uuid not null,
  source_snapshot jsonb not null,
  template_id uuid references public.social_templates(id),
  status public.social_content_status not null default 'generating',
  generation_method text not null default 'manual',
  generation_notes text,
  internal_notes text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  rejected_by uuid references auth.users(id),
  rejected_at timestamptz,
  rejection_reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_content_items_status_idx
  on public.social_content_items(status);

create index if not exists social_content_items_source_idx
  on public.social_content_items(source_entity_type, source_entity_id);

create table if not exists public.social_assets (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.social_content_items(id) on delete cascade,
  format public.social_asset_format not null,
  storage_bucket text not null,
  storage_path text not null,
  public_url text not null,
  mime_type text not null,
  width integer,
  height integer,
  file_size_bytes bigint,
  template_version integer,
  render_metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique(content_item_id, format)
);

create table if not exists public.social_platform_variants (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.social_content_items(id) on delete cascade,
  platform public.social_platform not null,
  connection_id uuid references public.social_connections(id),
  status public.social_variant_status not null default 'draft',
  caption text not null default '',
  title text,
  hashtags text[] not null default '{}',
  mentions text[] not null default '{}',
  selected_asset_id uuid references public.social_assets(id),
  platform_options jsonb not null default '{}',
  scheduled_for timestamptz,
  external_post_id text,
  external_permalink text,
  published_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(content_item_id, platform)
);

create index if not exists social_platform_variants_content_idx
  on public.social_platform_variants(content_item_id);

create index if not exists social_platform_variants_status_idx
  on public.social_platform_variants(status, scheduled_for);

create table if not exists public.social_publish_jobs (
  id uuid primary key default gen_random_uuid(),
  platform_variant_id uuid not null references public.social_platform_variants(id) on delete cascade,
  status public.social_job_status not null default 'queued',
  scheduled_for timestamptz not null,
  available_at timestamptz not null,
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  locked_at timestamptz,
  locked_by text,
  idempotency_key text not null unique,
  provider_publish_id text,
  provider_response jsonb,
  last_error_code text,
  last_error_message text,
  last_error_details jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_publish_jobs_claim_idx
  on public.social_publish_jobs(status, available_at, scheduled_for);

create index if not exists social_publish_jobs_variant_idx
  on public.social_publish_jobs(platform_variant_id);

create table if not exists public.social_content_events (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.social_content_items(id) on delete cascade,
  platform_variant_id uuid references public.social_platform_variants(id) on delete cascade,
  event_type text not null,
  actor_user_id uuid references auth.users(id),
  event_data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists social_content_events_content_idx
  on public.social_content_events(content_item_id, created_at desc);

create index if not exists social_content_events_variant_idx
  on public.social_content_events(platform_variant_id, created_at desc);

drop trigger if exists social_connections_updated_at on public.social_connections;
create trigger social_connections_updated_at
  before update on public.social_connections
  for each row execute function public.update_updated_at();

drop trigger if exists social_templates_updated_at on public.social_templates;
create trigger social_templates_updated_at
  before update on public.social_templates
  for each row execute function public.update_updated_at();

drop trigger if exists social_content_items_updated_at on public.social_content_items;
create trigger social_content_items_updated_at
  before update on public.social_content_items
  for each row execute function public.update_updated_at();

drop trigger if exists social_platform_variants_updated_at on public.social_platform_variants;
create trigger social_platform_variants_updated_at
  before update on public.social_platform_variants
  for each row execute function public.update_updated_at();

drop trigger if exists social_publish_jobs_updated_at on public.social_publish_jobs;
create trigger social_publish_jobs_updated_at
  before update on public.social_publish_jobs
  for each row execute function public.update_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'social-published-assets',
  'social-published-assets',
  true,
  52428800,
  array['image/png', 'image/jpeg', 'image/webp', 'video/mp4']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.social_connections enable row level security;
alter table public.social_templates enable row level security;
alter table public.social_content_items enable row level security;
alter table public.social_assets enable row level security;
alter table public.social_platform_variants enable row level security;
alter table public.social_publish_jobs enable row level security;
alter table public.social_content_events enable row level security;

drop policy if exists "social_connections_admin_all" on public.social_connections;
create policy "social_connections_admin_all"
  on public.social_connections
  for all
  to authenticated
  using (public.is_social_studio_admin())
  with check (public.is_social_studio_admin());

drop policy if exists "social_templates_admin_all" on public.social_templates;
create policy "social_templates_admin_all"
  on public.social_templates
  for all
  to authenticated
  using (public.is_social_studio_admin())
  with check (public.is_social_studio_admin());

drop policy if exists "social_content_items_admin_all" on public.social_content_items;
create policy "social_content_items_admin_all"
  on public.social_content_items
  for all
  to authenticated
  using (public.is_social_studio_admin())
  with check (public.is_social_studio_admin());

drop policy if exists "social_assets_admin_all" on public.social_assets;
create policy "social_assets_admin_all"
  on public.social_assets
  for all
  to authenticated
  using (public.is_social_studio_admin())
  with check (public.is_social_studio_admin());

drop policy if exists "social_platform_variants_admin_all" on public.social_platform_variants;
create policy "social_platform_variants_admin_all"
  on public.social_platform_variants
  for all
  to authenticated
  using (public.is_social_studio_admin())
  with check (public.is_social_studio_admin());

drop policy if exists "social_publish_jobs_admin_all" on public.social_publish_jobs;
create policy "social_publish_jobs_admin_all"
  on public.social_publish_jobs
  for all
  to authenticated
  using (public.is_social_studio_admin())
  with check (public.is_social_studio_admin());

drop policy if exists "social_content_events_admin_all" on public.social_content_events;
create policy "social_content_events_admin_all"
  on public.social_content_events
  for all
  to authenticated
  using (public.is_social_studio_admin())
  with check (public.is_social_studio_admin());

drop policy if exists "social_assets_storage_admin_insert" on storage.objects;
create policy "social_assets_storage_admin_insert"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'social-published-assets' and public.is_social_studio_admin());

drop policy if exists "social_assets_storage_admin_update" on storage.objects;
create policy "social_assets_storage_admin_update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'social-published-assets' and public.is_social_studio_admin())
  with check (bucket_id = 'social-published-assets' and public.is_social_studio_admin());

drop policy if exists "social_assets_storage_admin_delete" on storage.objects;
create policy "social_assets_storage_admin_delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'social-published-assets' and public.is_social_studio_admin());

revoke all on public.social_connections from anon;
revoke all on public.social_templates from anon;
revoke all on public.social_content_items from anon;
revoke all on public.social_assets from anon;
revoke all on public.social_platform_variants from anon;
revoke all on public.social_publish_jobs from anon;
revoke all on public.social_content_events from anon;

grant select, insert, update, delete on public.social_connections to authenticated, service_role;
grant select, insert, update, delete on public.social_templates to authenticated, service_role;
grant select, insert, update, delete on public.social_content_items to authenticated, service_role;
grant select, insert, update, delete on public.social_assets to authenticated, service_role;
grant select, insert, update, delete on public.social_platform_variants to authenticated, service_role;
grant select, insert, update, delete on public.social_publish_jobs to authenticated, service_role;
grant select, insert, update, delete on public.social_content_events to authenticated, service_role;

insert into public.social_templates (slug, name, content_type, version, template_config, is_active)
values
  (
    'actor-spotlight-v1',
    'Actor Spotlight',
    'actor_spotlight',
    1,
    '{"formats":["portrait_4_5","square_1_1","vertical_9_16"],"brand":"muvidb"}'::jsonb,
    true
  ),
  (
    'upcoming-movie-v1',
    'Upcoming Movie',
    'upcoming_movie',
    1,
    '{"formats":["portrait_4_5","square_1_1","vertical_9_16"],"brand":"muvidb"}'::jsonb,
    true
  )
on conflict (slug) do update
set name = excluded.name,
    content_type = excluded.content_type,
    version = excluded.version,
    template_config = excluded.template_config,
    is_active = excluded.is_active,
    updated_at = now();
