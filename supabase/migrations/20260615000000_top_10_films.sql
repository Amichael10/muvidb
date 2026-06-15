-- ==============================================================================
-- 20260615000000_top_10_films.sql — Run this in your Supabase SQL Editor
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.top_10_films (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  film_id UUID NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL UNIQUE CHECK (rank >= 1 AND rank <= 10),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.top_10_films ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to top_10_films" ON public.top_10_films FOR SELECT USING (true);
CREATE POLICY "Allow authenticated full access to top_10_films" ON public.top_10_films FOR ALL USING (auth.role() = 'authenticated');
