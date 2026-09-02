-- Content Engine destinations are separate editorial channels/accounts, not
-- merely social platforms. Content remains shared, while routing and copy are
-- destination-specific.
create table if not exists public.content_destinations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  editorial_profile jsonb not null default '{}',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_destination_platforms (
  id uuid primary key default gen_random_uuid(),
  destination_id uuid not null references public.content_destinations(id) on delete cascade,
  platform public.social_platform not null,
  social_connection_id uuid references public.social_connections(id) on delete set null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique(destination_id, platform)
);

alter table public.social_content_items
  add column if not exists destination_id uuid references public.content_destinations(id) on delete set null;

create index if not exists social_content_items_destination_idx
  on public.social_content_items(destination_id, status);

insert into public.content_destinations (slug, name, description, editorial_profile)
values
  ('main-muvidb', 'Main MuviDB', 'General film discovery and video clips', '{"voice":["useful","film-loving"]}'),
  ('where-to-watch', 'Where to Watch by MuviDB', 'Availability and streaming discovery', '{"voice":["fast","clear","credible"]}'),
  ('muvidb-critics', 'MuviDB Critics', 'Reviews, ratings and critic conversations', '{"voice":["informed","conversational","fair"]}'),
  ('nollywood-debate', 'Nollywood Debate', 'Questions and community discussion', '{"voice":["direct","playful","respectful"]}'),
  ('muvidb-people', 'MuviDB People', 'Actor and filmmaker spotlights', '{"voice":["warm","informed"]}')
on conflict (slug) do nothing;

drop trigger if exists content_destinations_updated_at on public.content_destinations;
create trigger content_destinations_updated_at
  before update on public.content_destinations
  for each row execute function public.update_updated_at();

alter table public.content_destinations enable row level security;
alter table public.content_destination_platforms enable row level security;

drop policy if exists content_destinations_admin_all on public.content_destinations;
create policy content_destinations_admin_all on public.content_destinations
  for all using (public.is_social_studio_admin()) with check (public.is_social_studio_admin());

drop policy if exists content_destination_platforms_admin_all on public.content_destination_platforms;
create policy content_destination_platforms_admin_all on public.content_destination_platforms
  for all using (public.is_social_studio_admin()) with check (public.is_social_studio_admin());

grant select, insert, update, delete on public.content_destinations to authenticated, service_role;
grant select, insert, update, delete on public.content_destination_platforms to authenticated, service_role;
