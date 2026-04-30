-- Migration: Homepage Sections and Editorial Collections
-- Date: 2026-04-27

-- 1. Add specific flags for homepage filtering to films
ALTER TABLE public.films ADD COLUMN IF NOT EXISTS is_in_cinemas BOOLEAN DEFAULT false;
ALTER TABLE public.films ADD COLUMN IF NOT EXISTS coming_soon BOOLEAN DEFAULT false;

-- 2. Create collections table for editorial picks
CREATE TABLE IF NOT EXISTS public.collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    slug TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create collection_films junction table
CREATE TABLE IF NOT EXISTS public.collection_films (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID REFERENCES public.collections(id) ON DELETE CASCADE,
    film_id UUID REFERENCES public.films(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(collection_id, film_id)
);

-- 4. Enable RLS
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_films ENABLE ROW LEVEL SECURITY;

-- 5. Policies
DROP POLICY IF EXISTS "Collections are viewable by everyone" ON public.collections;
CREATE POLICY "Collections are viewable by everyone" ON public.collections
    FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Collection films are viewable by everyone" ON public.collection_films;
CREATE POLICY "Collection films are viewable by everyone" ON public.collection_films
    FOR SELECT USING (true);

-- 6. Insert an initial curated pick example
INSERT INTO public.collections (name, description, slug, is_featured)
VALUES ('Nollywood Classics', 'The films that defined a generation and built an industry.', 'nollywood-classics', true)
ON CONFLICT (slug) DO NOTHING;

-- 7. Backfill is_in_cinemas based on existing showtimes
UPDATE public.films f
SET is_in_cinemas = true
WHERE EXISTS (
    SELECT 1 FROM public.showtimes s 
    WHERE s.film_id = f.id 
    AND s.show_date >= CURRENT_DATE
);
