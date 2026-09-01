-- Migration: 20260901000003_create_person_media_table.sql
-- Description: Creates person_media table for IMDb-style photos, showreels, monologues, and scene clips.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'person_media_type') THEN
    CREATE TYPE public.person_media_type AS ENUM ('photo', 'video');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'person_media_category') THEN
    CREATE TYPE public.person_media_category AS ENUM (
      'showreel',
      'monologue',
      'scene_clip',
      'interview',
      'headshot',
      'production_still',
      'red_carpet',
      'behind_the_scenes'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_moderation_status') THEN
    CREATE TYPE public.media_moderation_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.person_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  media_type public.person_media_type NOT NULL,
  category public.person_media_category NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  
  -- Media Sources
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  r2_key TEXT,
  embed_provider TEXT,
  embed_id TEXT,
  
  -- Dimensions & Durations
  duration_seconds INTEGER,
  width INTEGER,
  height INTEGER,
  aspect_ratio TEXT,
  
  -- Context & Film Tagging
  film_id UUID REFERENCES public.films(id) ON DELETE SET NULL,
  character_name TEXT,
  photographer_credit TEXT,
  year INTEGER,
  
  -- Ordering & Hero Pinning
  is_primary BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  
  -- Moderation & Audit
  status public.media_moderation_status DEFAULT 'approved',
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_person_media_person_type 
  ON public.person_media(person_id, media_type, status, sort_order);

CREATE INDEX IF NOT EXISTS idx_person_media_film 
  ON public.person_media(film_id);

-- Row Level Security
ALTER TABLE public.person_media ENABLE ROW LEVEL SECURITY;

-- 1. Public Read for approved media
CREATE POLICY "Public can view approved person media"
  ON public.person_media
  FOR SELECT
  USING (status = 'approved');

-- 2. Service role full access
CREATE POLICY "Service role full access on person_media"
  ON public.person_media
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
