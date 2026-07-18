-- =============================================================================
-- FILMS.ORIGINAL_TITLE — preserve the raw scraped title when cleaning
-- =============================================================================
-- The title-cleaning pipeline replaces farm-style YouTube titles ("You Won't
-- Believe... TWO Stubborn Hearts Latest Nigerian Full Movie") with the real
-- film name ("Two Stubborn Hearts"). We keep the original here so the change is
-- fully reversible and auditable: to revert, copy original_title back to title
-- where original_title is not null.
--
-- Nullable: only rows that were actually cleaned carry a value; everything else
-- stays null and untouched.
-- =============================================================================

alter table public.films
  add column if not exists original_title text;
