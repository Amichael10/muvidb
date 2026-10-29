-- Migration: 20261028000000_create_film_media_table.sql
-- Description: Creates film_media table for film posters, backdrops, production stills, behind-the-scenes photos, premiere red-carpet pictures, and promotional media.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'film_media_type') THEN
    CREATE TYPE public.film_media_type AS ENUM ('photo', 'video', 'poster', 'backdrop');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'film_media_category') THEN
    CREATE TYPE public.film_media_category AS ENUM (
      'poster',
      'backdrop',
      'production_still',
      'behind_the_scenes',
      'red_carpet',
      'premiere',
      'screencap',
      'wallpaper',
      'trailer',
      'teaser',
      'clip',
      'interview'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.film_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  film_id UUID NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  media_type public.film_media_type NOT NULL DEFAULT 'photo',
  category public.film_media_category NOT NULL DEFAULT 'production_still',
  title TEXT,
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
  
  -- Context & Credits
  photographer_credit TEXT,
  year INTEGER,
  tags TEXT[],
  
  -- Ordering & Hero Pinning
  is_primary BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  
  -- Moderation & Audit
  status public.media_moderation_status DEFAULT 'approved',
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for rapid querying
CREATE INDEX IF NOT EXISTS idx_film_media_film_type 
  ON public.film_media(film_id, media_type, status, sort_order);

CREATE INDEX IF NOT EXISTS idx_film_media_category 
  ON public.film_media(category);

CREATE INDEX IF NOT EXISTS idx_film_media_status 
  ON public.film_media(status);

-- Row Level Security
ALTER TABLE public.film_media ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.film_media TO authenticated;
GRANT ALL ON public.film_media TO service_role;
GRANT SELECT ON public.film_media TO anon;

-- 1. Public Read for approved media
DROP POLICY IF EXISTS "Public can view approved film media" ON public.film_media;
CREATE POLICY "Public can view approved film media"
  ON public.film_media
  FOR SELECT
  USING (status = 'approved');

-- 2. Authenticated users can insert film media
DROP POLICY IF EXISTS "Authenticated users can upload film media" ON public.film_media;
CREATE POLICY "Authenticated users can upload film media"
  ON public.film_media
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid() OR uploaded_by IS NULL
  );

-- 3. Uploaders can update their film media
DROP POLICY IF EXISTS "Uploaders can update their film media" ON public.film_media;
CREATE POLICY "Uploaders can update their film media"
  ON public.film_media
  FOR UPDATE
  TO authenticated
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());

-- 4. Uploaders can delete their film media
DROP POLICY IF EXISTS "Uploaders can delete their film media" ON public.film_media;
CREATE POLICY "Uploaders can delete their film media"
  ON public.film_media
  FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid());

-- 5. Service role full access
DROP POLICY IF EXISTS "Service role full access on film_media" ON public.film_media;
CREATE POLICY "Service role full access on film_media"
  ON public.film_media
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
