-- =============================================================================
-- 20260910130000_add_play_reviews_support.sql
-- Enables stage plays to receive user reviews and critic reviews
-- =============================================================================

-- 1. Add play_id column to reviews & critic_reviews
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS play_id UUID REFERENCES public.plays(id) ON DELETE CASCADE;
ALTER TABLE public.critic_reviews ADD COLUMN IF NOT EXISTS play_id UUID REFERENCES public.plays(id) ON DELETE CASCADE;

-- 2. Allow film_id to be nullable so reviews can be for a film OR a play
ALTER TABLE public.reviews ALTER COLUMN film_id DROP NOT NULL;
ALTER TABLE public.critic_reviews ALTER COLUMN film_id DROP NOT NULL;

-- 3. Create indices for performance
CREATE INDEX IF NOT EXISTS idx_reviews_play_id ON public.reviews(play_id);
CREATE INDEX IF NOT EXISTS idx_critic_reviews_play_id ON public.critic_reviews(play_id);

-- 4. Ensure RLS policies support reviews on plays
DROP POLICY IF EXISTS "Users can insert reviews for plays" ON public.reviews;
CREATE POLICY "Users can insert reviews for plays"
  ON public.reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND (film_id IS NOT NULL OR play_id IS NOT NULL));
