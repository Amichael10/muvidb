-- Source-backed actor box-office rankings, e.g. FilmOne Nigerian Box Office Yearbook.
-- These are ranking facts for a given year/category, not lifetime actor totals.

CREATE TABLE IF NOT EXISTS public.person_box_office_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  category TEXT NOT NULL,
  rank INTEGER NOT NULL,
  gross_label TEXT NOT NULL,
  gross_ngn_estimate NUMERIC(15, 2) NOT NULL,
  films TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  film_ids UUID[] NOT NULL DEFAULT '{}'::UUID[],
  source_name TEXT NOT NULL,
  source_url TEXT,
  source_page INTEGER,
  criteria TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT person_box_office_rankings_unique_source_row UNIQUE (
    person_id,
    year,
    category,
    rank,
    source_name
  )
);

CREATE INDEX IF NOT EXISTS person_box_office_rankings_person_idx
  ON public.person_box_office_rankings(person_id);

CREATE INDEX IF NOT EXISTS person_box_office_rankings_year_category_idx
  ON public.person_box_office_rankings(year, category, rank);

CREATE INDEX IF NOT EXISTS person_box_office_rankings_gross_idx
  ON public.person_box_office_rankings(gross_ngn_estimate DESC NULLS LAST);

DROP TRIGGER IF EXISTS person_box_office_rankings_updated_at
  ON public.person_box_office_rankings;

CREATE TRIGGER person_box_office_rankings_updated_at
  BEFORE UPDATE ON public.person_box_office_rankings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.person_box_office_rankings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.person_box_office_rankings TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.person_box_office_rankings TO authenticated, service_role;

DROP POLICY IF EXISTS "Public person box office rankings read access"
  ON public.person_box_office_rankings;
CREATE POLICY "Public person box office rankings read access"
  ON public.person_box_office_rankings
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins manage person box office rankings"
  ON public.person_box_office_rankings;
CREATE POLICY "Admins manage person box office rankings"
  ON public.person_box_office_rankings
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Service role manages person box office rankings"
  ON public.person_box_office_rankings;
CREATE POLICY "Service role manages person box office rankings"
  ON public.person_box_office_rankings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
