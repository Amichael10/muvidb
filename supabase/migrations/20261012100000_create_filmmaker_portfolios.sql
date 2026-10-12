-- Migration: Claimable Filmmaker Portfolio (Linktree / Creator Hub)
-- Enables verified talent and directors to create custom, isolated public portfolio pages
-- without compromising core catalogue integrity.

CREATE TABLE IF NOT EXISTS public.filmmaker_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  handle TEXT NOT NULL,
  tagline TEXT,
  bio_statement TEXT,
  featured_reel_url TEXT,
  featured_film_ids UUID[] DEFAULT '{}',
  custom_links JSONB DEFAULT '[]'::jsonb,
  inquiry_email TEXT,
  inquiry_phone TEXT,
  epk_pdf_url TEXT,
  theme_preset TEXT DEFAULT 'midnight',
  accent_color TEXT DEFAULT '#f59e0b',
  is_published BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT filmmaker_portfolios_handle_unique UNIQUE (handle),
  CONSTRAINT filmmaker_portfolios_person_unique UNIQUE (person_id),
  CONSTRAINT filmmaker_portfolios_user_unique UNIQUE (user_id)
);

-- Case-insensitive search on handles (e.g., @kunle, @KUNLE)
CREATE UNIQUE INDEX IF NOT EXISTS idx_filmmaker_portfolios_lower_handle
  ON public.filmmaker_portfolios (LOWER(handle));

CREATE INDEX IF NOT EXISTS idx_filmmaker_portfolios_person_id
  ON public.filmmaker_portfolios (person_id);

CREATE INDEX IF NOT EXISTS idx_filmmaker_portfolios_user_id
  ON public.filmmaker_portfolios (user_id);

-- Enable Row Level Security
ALTER TABLE public.filmmaker_portfolios ENABLE ROW LEVEL SECURITY;

-- 1. Anyone can view published portfolios
DROP POLICY IF EXISTS "Public can view published filmmaker portfolios" ON public.filmmaker_portfolios;
CREATE POLICY "Public can view published filmmaker portfolios"
  ON public.filmmaker_portfolios
  FOR SELECT
  USING (is_published = true OR auth.uid() = user_id);

-- 2. Claimed creators can insert their own portfolio
DROP POLICY IF EXISTS "Users can insert their own filmmaker portfolio" ON public.filmmaker_portfolios;
CREATE POLICY "Users can insert their own filmmaker portfolio"
  ON public.filmmaker_portfolios
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. Claimed creators can update their own portfolio
DROP POLICY IF EXISTS "Users can update their own filmmaker portfolio" ON public.filmmaker_portfolios;
CREATE POLICY "Users can update their own filmmaker portfolio"
  ON public.filmmaker_portfolios
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Service role has full management
DROP POLICY IF EXISTS "Service role full access on filmmaker_portfolios" ON public.filmmaker_portfolios;
CREATE POLICY "Service role full access on filmmaker_portfolios"
  ON public.filmmaker_portfolios
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. RPC to atomically increment portfolio view count
CREATE OR REPLACE FUNCTION public.increment_portfolio_views(p_handle TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.filmmaker_portfolios
  SET view_count = COALESCE(view_count, 0) + 1,
      updated_at = NOW()
  WHERE LOWER(handle) = LOWER(p_handle);
END;
$$;
