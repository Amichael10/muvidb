-- Migration: 20261108173000_create_play_images_table.sql
-- Description: Creates play_images table for theatrical stage play galleries, production stills, posters, backstage photos, and performance imagery.

CREATE TABLE IF NOT EXISTS public.play_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  play_id UUID NOT NULL REFERENCES public.plays(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  image_type TEXT NOT NULL DEFAULT 'production_still',
  sort_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT FALSE,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for rapid querying
CREATE INDEX IF NOT EXISTS idx_play_images_play_order 
  ON public.play_images(play_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_play_images_type 
  ON public.play_images(image_type);

-- Row Level Security
ALTER TABLE public.play_images ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.play_images TO authenticated;
GRANT ALL ON public.play_images TO service_role;
GRANT SELECT ON public.play_images TO anon;

-- 1. Public Read for play images
DROP POLICY IF EXISTS "Public can view play images" ON public.play_images;
CREATE POLICY "Public can view play images"
  ON public.play_images
  FOR SELECT
  USING (true);

-- 2. Authenticated users can insert
DROP POLICY IF EXISTS "Authenticated users can insert play images" ON public.play_images;
CREATE POLICY "Authenticated users can insert play images"
  ON public.play_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid() OR uploaded_by IS NULL
  );

-- 3. Admins or uploaders can update
DROP POLICY IF EXISTS "Admins or uploaders can update play images" ON public.play_images;
CREATE POLICY "Admins or uploaders can update play images"
  ON public.play_images
  FOR UPDATE
  TO authenticated
  USING (
    uploaded_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
  )
  WITH CHECK (
    uploaded_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

-- 4. Admins or uploaders can delete
DROP POLICY IF EXISTS "Admins or uploaders can delete play images" ON public.play_images;
CREATE POLICY "Admins or uploaders can delete play images"
  ON public.play_images
  FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

-- 5. Service role full access
DROP POLICY IF EXISTS "Service role full access on play_images" ON public.play_images;
CREATE POLICY "Service role full access on play_images"
  ON public.play_images
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
