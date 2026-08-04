-- Persist "Watched" on watchlist rows + allow owners to update their rows.

ALTER TABLE public.watchlist
  ADD COLUMN IF NOT EXISTS watched boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS watched_at timestamptz NULL;

COMMENT ON COLUMN public.watchlist.watched IS 'User marked this watchlist title as already seen.';
COMMENT ON COLUMN public.watchlist.watched_at IS 'When the user marked the title watched (null if not watched).';

DROP POLICY IF EXISTS "Allow user update own watchlist" ON public.watchlist;
CREATE POLICY "Allow user update own watchlist" ON public.watchlist
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
