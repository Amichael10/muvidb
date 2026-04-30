-- Add MUBI tracking columns to films
ALTER TABLE public.films 
ADD COLUMN IF NOT EXISTS mubi_id TEXT,
ADD COLUMN IF NOT EXISTS mubi_slug TEXT;

-- Create index for faster lookups during sync
CREATE INDEX IF NOT EXISTS idx_films_mubi_id ON public.films(mubi_id);
CREATE INDEX IF NOT EXISTS idx_films_mubi_slug ON public.films(mubi_slug);
