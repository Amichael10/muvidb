-- =============================================================================
-- Keep people.film_count TRUE to the credits table.
-- =============================================================================
-- film_count was only ever recalculated inside merge_people, so ordinary credit
-- inserts (OCR, YouTube sync, TMDB, awards) never updated it. It drifted badly:
-- a sample of 40 people showing film_count = 0 ALL had real credits.
--
-- That stale value is load-bearing in several places:
--   * rankPersonMatch() / pickAutoMatch() pick the "richest" duplicate by it,
--     so a wrong value picks the wrong survivor when auto-linking credits;
--   * purge_orphan_people + the dedupe scripts treat film_count = 0 as "empty
--     stub" — on the stale data that mis-classified ~6,700 real people as
--     deletable orphans;
--   * the admin deduplicator UI shows it as "CREDITS", so reviewers were
--     comparing duplicates using numbers that were simply wrong.
--
-- Fix: recompute on every credits change, plus a one-time backfill.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_person_film_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.person_id IS NOT NULL THEN
    UPDATE public.people p
      SET film_count = (SELECT count(DISTINCT c.film_id) FROM public.credits c WHERE c.person_id = p.id)
      WHERE p.id = NEW.person_id;
  END IF;

  IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') AND OLD.person_id IS NOT NULL
     AND (TG_OP = 'DELETE' OR OLD.person_id IS DISTINCT FROM NEW.person_id) THEN
    UPDATE public.people p
      SET film_count = (SELECT count(DISTINCT c.film_id) FROM public.credits c WHERE c.person_id = p.id)
      WHERE p.id = OLD.person_id;
  END IF;

  RETURN NULL; -- AFTER trigger
END;
$$;

DROP TRIGGER IF EXISTS trg_credits_sync_film_count ON public.credits;
CREATE TRIGGER trg_credits_sync_film_count
  AFTER INSERT OR DELETE OR UPDATE OF person_id, film_id ON public.credits
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_person_film_count();

-- One-time backfill: set every person's real count.
UPDATE public.people p
SET film_count = sub.cnt
FROM (
  SELECT person_id, count(DISTINCT film_id) AS cnt
  FROM public.credits
  WHERE person_id IS NOT NULL
  GROUP BY person_id
) sub
WHERE p.id = sub.person_id
  AND p.film_count IS DISTINCT FROM sub.cnt;

-- ...and zero out people who genuinely have no credits.
UPDATE public.people p
SET film_count = 0
WHERE p.film_count IS DISTINCT FROM 0
  AND NOT EXISTS (SELECT 1 FROM public.credits c WHERE c.person_id = p.id);
