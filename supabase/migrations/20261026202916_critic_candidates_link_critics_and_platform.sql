-- Two corrections to the video critic review queue.
--
-- 1. Attribution belongs to public.critics, which already holds name, title,
--    publication, avatar_url, handle and profile_url, and which
--    critic_reviews.critic_id already references. The previous migration
--    carried its own copies on critic_channels, so an approved video review
--    would not have appeared on the critic's own /critics/:slug page. The
--    copies are dropped and a critic_id reference takes their place.
--
-- 2. Not every critic publishes on YouTube. A candidate now records which
--    platform it came from, so an Instagram review can be queued by hand and
--    approved without pretending to be a YouTube video. critic_channels stays
--    YouTube-only — it exists for uploads-playlist polling — and an Instagram
--    critic is attributed through the candidate's own critic_id instead.
--
-- Written as a separate additive migration rather than an edit to
-- 20261026200304 so it converges whether or not that one has been applied.

ALTER TABLE public.critic_channels
  ADD COLUMN IF NOT EXISTS critic_id uuid REFERENCES public.critics(id) ON DELETE SET NULL;

ALTER TABLE public.critic_channels
  DROP COLUMN IF EXISTS social_handle,
  DROP COLUMN IF EXISTS publication,
  DROP COLUMN IF EXISTS avatar_url;

CREATE INDEX IF NOT EXISTS critic_channels_critic_idx
  ON public.critic_channels(critic_id)
  WHERE critic_id IS NOT NULL;

ALTER TABLE public.critic_review_candidates
  -- Set directly for a review submitted by hand, where there is no channel to
  -- inherit attribution from. Takes precedence over the channel's critic.
  ADD COLUMN IF NOT EXISTS critic_id uuid REFERENCES public.critics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_platform text NOT NULL DEFAULT 'youtube';

ALTER TABLE public.critic_review_candidates
  DROP CONSTRAINT IF EXISTS critic_review_candidates_source_platform_check;

ALTER TABLE public.critic_review_candidates
  ADD CONSTRAINT critic_review_candidates_source_platform_check
  CHECK (source_platform IN ('youtube', 'instagram', 'tiktok', 'other'));

CREATE INDEX IF NOT EXISTS critic_review_candidates_critic_idx
  ON public.critic_review_candidates(critic_id)
  WHERE critic_id IS NOT NULL;

COMMENT ON COLUMN public.critic_review_candidates.source_platform IS
  'Where the review was published. Only youtube supports a timestamp deep link, so a quote from any other platform cannot be click-verified and the reviewer is told so.';
COMMENT ON COLUMN public.critic_review_candidates.critic_id IS
  'Attribution for a hand-submitted review. Falls back to the channel''s critic_id when null.';
