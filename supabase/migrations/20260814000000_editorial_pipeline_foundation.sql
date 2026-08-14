-- =============================================================================
-- 20260814000000_editorial_pipeline_foundation.sql
-- Adds MuviDB Editorial Content Pipeline tables, RLS policies, and seed data.
-- =============================================================================

-- 1. ENUMS FOR EDITORIAL PIPELINE
do $$
begin
  if not exists (select 1 from pg_type where typname = 'editorial_calendar_status') then
    create type public.editorial_calendar_status as enum (
      'planned',
      'selecting',
      'subject_selected',
      'draft_ready',
      'needs_review',
      'approved',
      'designed',
      'published',
      'skipped',
      'cancelled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'editorial_draft_status') then
    create type public.editorial_draft_status as enum (
      'generating',
      'draft',
      'needs_review',
      'approved',
      'designed',
      'published',
      'rejected'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'editorial_event_status') then
    create type public.editorial_event_status as enum (
      'new',
      'reviewed',
      'converted_to_draft',
      'ignored',
      'expired'
    );
  end if;
end $$;

-- 2. CONTENT SERIES REGISTRY
create table if not exists public.social_content_series (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  category text not null, -- 'people', 'craft', 'discovery', 'data', 'community', 'critics', 'theatre', 'timely'
  active boolean not null default true,
  default_frequency text not null default 'weekly',
  preferred_platforms text[] not null default '{"instagram", "threads", "x"}',
  preferred_format text not null default 'carousel', -- 'carousel', 'single_image', 'text', 'video'
  min_candidate_score numeric(5,2) not null default 50.00,
  cooldown_days integer not null default 60,
  requires_photo boolean not null default true,
  requires_poster boolean not null default false,
  requires_streaming boolean not null default false,
  requires_reviews boolean not null default false,
  min_reviews integer not null default 0,
  figma_template_key text,
  config jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_content_series_category_idx on public.social_content_series(category, active);

-- 3. EDITORIAL CALENDAR (30-Day Rolling Slots)
create table if not exists public.social_calendar (
  id uuid primary key default gen_random_uuid(),
  scheduled_date date not null,
  scheduled_time time,
  series_id uuid references public.social_content_series(id) on delete set null,
  status public.editorial_calendar_status not null default 'planned',
  subject_entity_type text, -- 'movie', 'person', 'critic', 'play', 'company'
  subject_entity_id uuid,
  selection_locked boolean not null default false,
  priority text not null default 'normal', -- 'low', 'normal', 'high', 'urgent'
  source text not null default 'planned', -- 'planned', 'reactive', 'manual', 'database_event'
  notes text,
  draft_id uuid,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_calendar_date_status_idx on public.social_calendar(scheduled_date DESC, status);
create index if not exists social_calendar_entity_idx on public.social_calendar(subject_entity_type, subject_entity_id);

-- 4. EDITORIAL DRAFTS (Fact-packs, Angles, Copy & Figma Briefs)
create table if not exists public.social_drafts (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid references public.social_calendar(id) on delete set null,
  series_id uuid references public.social_content_series(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  status public.editorial_draft_status not null default 'draft',
  candidate_score numeric(5,2) default 0.00,
  selection_reason jsonb not null default '{}',
  angle_id text,
  angle_json jsonb not null default '{}',
  fact_pack_json jsonb not null default '{}',
  content_json jsonb not null default '{}',
  edited_content_json jsonb,
  caption_style text,
  figma_template_key text,
  validation_results jsonb not null default '{"valid": true, "warnings": []}',
  ai_model text,
  prompt_version text,
  editor_notes text,
  created_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_drafts_status_idx on public.social_drafts(status, created_at DESC);
create index if not exists social_drafts_entity_idx on public.social_drafts(entity_type, entity_id);

-- 5. ENTITY PUBLICATION HISTORY (Cooldown & Diversity Analytics)
create table if not exists public.social_entity_history (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  series_id uuid references public.social_content_series(id) on delete set null,
  draft_id uuid references public.social_drafts(id) on delete set null,
  calendar_id uuid references public.social_calendar(id) on delete set null,
  published_at timestamptz not null default now(),
  angle text,
  caption_style text,
  platforms text[] not null default '{"instagram"}',
  country text,
  profession text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists social_entity_history_published_idx on public.social_entity_history(published_at DESC);
create index if not exists social_entity_history_entity_idx on public.social_entity_history(entity_type, entity_id, published_at DESC);

-- 6. REACTIVE NEWS & CONTENT OPPORTUNITIES QUEUE
create table if not exists public.social_news_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null, -- 'movie_announcement', 'trailer', 'casting', 'streaming_release', 'cinema_release', 'festival', 'award', 'theatre', 'critic_review', 'manual'
  entity_type text,
  entity_id uuid,
  title text not null,
  description text,
  source_type text not null default 'manual', -- 'manual', 'db_trigger', 'web_alert'
  source_url text,
  detected_at timestamptz not null default now(),
  event_date date,
  urgency text not null default 'medium', -- 'low', 'medium', 'high', 'urgent'
  confidence numeric(3,2) default 1.00,
  status public.editorial_event_status not null default 'new',
  draft_id uuid references public.social_drafts(id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_news_events_status_idx on public.social_news_events(status, urgency, detected_at DESC);

-- 7. PROMPT TEMPLATES (Versioned Cohere System Instructions)
create table if not exists public.social_prompt_templates (
  id uuid primary key default gen_random_uuid(),
  task_type text not null, -- 'candidate_ranking', 'angle_generation', 'copywriting', 'review_comparison', 'fact_checking', 'event_classification'
  name text not null,
  version integer not null default 1,
  prompt text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(task_type, version)
);

-- 8. AI GENERATION TELEMETRY & LOGS
create table if not exists public.social_generation_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'cohere',
  model text not null,
  task_type text not null,
  prompt_version integer,
  input_tokens integer default 0,
  output_tokens integer default 0,
  latency_ms integer default 0,
  success boolean not null default true,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists social_generation_logs_created_idx on public.social_generation_logs(created_at DESC);

-- 9. ROW LEVEL SECURITY (RLS) & PERMISSIONS
alter table public.social_content_series enable row level security;
alter table public.social_calendar enable row level security;
alter table public.social_drafts enable row level security;
alter table public.social_entity_history enable row level security;
alter table public.social_news_events enable row level security;
alter table public.social_prompt_templates enable row level security;
alter table public.social_generation_logs enable row level security;

-- Grants
grant select on public.social_content_series to anon, authenticated, service_role;
grant select on public.social_calendar to anon, authenticated, service_role;
grant select on public.social_drafts to anon, authenticated, service_role;
grant select on public.social_entity_history to anon, authenticated, service_role;
grant select on public.social_news_events to anon, authenticated, service_role;
grant select on public.social_prompt_templates to anon, authenticated, service_role;

grant all on public.social_content_series to authenticated, service_role;
grant all on public.social_calendar to authenticated, service_role;
grant all on public.social_drafts to authenticated, service_role;
grant all on public.social_entity_history to authenticated, service_role;
grant all on public.social_news_events to authenticated, service_role;
grant all on public.social_prompt_templates to authenticated, service_role;
grant all on public.social_generation_logs to authenticated, service_role;

-- Public read policies
drop policy if exists "public_read_series" on public.social_content_series;
create policy "public_read_series" on public.social_content_series for select using (true);

drop policy if exists "public_read_calendar" on public.social_calendar;
create policy "public_read_calendar" on public.social_calendar for select using (true);

drop policy if exists "public_read_drafts" on public.social_drafts;
create policy "public_read_drafts" on public.social_drafts for select using (true);

drop policy if exists "public_read_history" on public.social_entity_history;
create policy "public_read_history" on public.social_entity_history for select using (true);

drop policy if exists "public_read_news_events" on public.social_news_events;
create policy "public_read_news_events" on public.social_news_events for select using (true);

-- Admin all policies
drop policy if exists "admin_all_series" on public.social_content_series;
create policy "admin_all_series" on public.social_content_series for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin_all_calendar" on public.social_calendar;
create policy "admin_all_calendar" on public.social_calendar for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin_all_drafts" on public.social_drafts;
create policy "admin_all_drafts" on public.social_drafts for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin_all_history" on public.social_entity_history;
create policy "admin_all_history" on public.social_entity_history for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin_all_news_events" on public.social_news_events;
create policy "admin_all_news_events" on public.social_news_events for all using (public.is_admin()) with check (public.is_admin());

-- 10. SEED INITIAL CONTENT SERIES
insert into public.social_content_series (slug, name, description, category, cooldown_days, preferred_format, figma_template_key, config)
values
  ('filmography', 'The Filmography', 'Deep dive into an actor or filmmaker career & credits', 'people', 90, 'carousel', 'people-filmography', '{"min_credits": 5, "require_photo": true}'),
  ('you_know_the_face', 'You Know The Face', 'Spotlight on supporting or emerging Nollywood actors', 'people', 60, 'carousel', 'people-face', '{"min_credits": 3, "avoid_top_celebrities": true}'),
  ('behind_the_camera', 'Behind The Camera', 'Highlight directors, cinematographers, writers, & craft crew', 'craft', 45, 'carousel', 'crew-spotlight', '{"departments": ["Director", "Writer", "Cinematographer", "Editor", "Producer", "Sound", "Costume"]}'),
  ('where_to_watch', 'Where To Watch', 'Spotlight movies currently streaming or legally on YouTube', 'discovery', 30, 'single_image', 'where-to-watch', '{"requires_active_links": true}'),
  ('weekend_watchlist', 'Weekend Watchlist', 'Curated theme or genre grouping of 3-5 African films', 'discovery', 14, 'carousel', 'weekend-watchlist', '{"film_count": 4}'),
  ('by_the_numbers', 'MuviDB By The Numbers', 'SQL-calculated statistics and recurring collaborations', 'data', 30, 'single_image', 'data-story', '{"min_collaborations": 3}'),
  ('critics_say', 'What The Critics Say', 'Film review consensus and key themes from top reviewers', 'critics', 30, 'carousel', 'critics-roundup', '{"min_reviews": 2}'),
  ('the_critic', 'The Critic', 'Spotlight on verified film critics and their notable reviews', 'critics', 60, 'single_image', 'critic-spotlight', '{"min_reviews": 3}'),
  ('one_film_two_takes', 'One Film, Two Takes', 'Contrast differing perspectives from two film critics', 'critics', 45, 'carousel', 'critics-roundup', '{"min_rating_diff": 1.5}'),
  ('whats_on_stage', 'What’s On Stage', 'Upcoming theatre plays and live stage performances', 'theatre', 14, 'carousel', 'theatre-weekend', '{"requires_active_run": true}'),
  ('stage_to_screen', 'Stage To Screen', 'Performers who excel in both theatre and film', 'theatre', 60, 'carousel', 'people-filmography', '{"requires_stage_and_film": true}'),
  ('film_conversation', 'Film Conversation', 'Engaging discussion prompts around African cinema & craft', 'community', 7, 'text', 'conversation', '{"style": "conversational"}'),
  ('new_and_upcoming', 'New & Upcoming', 'Releases, trailer drops, and major announcements', 'timely', 7, 'single_image', 'movie-announcement', '{"requires_date_or_trailer": true}')
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  config = excluded.config;

-- 11. SEED DEFAULT PROMPT TEMPLATES
insert into public.social_prompt_templates (task_type, name, version, prompt, active)
values
  (
    'candidate_ranking',
    'Default Candidate Reranker',
    1,
    'You are the lead editor for MuviDB, the premier database for African cinema. Given the requested content series slot and recent posting history, evaluate and rank the candidates. Prioritize diversity in geography, craft department, and freshness. Output strict JSON array of candidate IDs.',
    true
  ),
  (
    'angle_generation',
    'Editorial Angle Generator',
    1,
    'Given ONLY the verified facts supplied in the FACT_PACK, suggest 3 to 5 distinct, compelling editorial angles for a social post. Do NOT invent facts, awards, ratings, or relationships not in the FACT_PACK. Output strict JSON.',
    true
  ),
  (
    'copywriting',
    'Multi-Platform Copywriter',
    1,
    'Write social media content for MuviDB in an knowledgeable, curious, film-loving editorial tone. Strictly adhere to facts in the FACT_PACK. Never use buzzwords like "thrilled", "banger", "legendary", or "iconic" without proof. Output strict JSON with headline, Figma slide copy, Instagram caption, X post, Threads post, and TikTok caption.',
    true
  )
on conflict (task_type, version) do update set
  prompt = excluded.prompt;
