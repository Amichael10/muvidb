-- Video critic reviews: most Nigerian film critics publish on YouTube and
-- Instagram rather than in writing, so critics_sync (RSS + article scrape)
-- cannot see them at all.
--
-- Two tables:
--   critic_channels           the curated critics worth watching
--   critic_review_candidates  one row per review video, from discovery through
--                             transcript and extraction to approval
--
-- Candidates are deliberately NOT public-read. A quote taken from a caption
-- track or from Whisper is exact to the transcript, not necessarily to what the
-- critic said, so nothing reaches the public critic_reviews table without a
-- human approving it first.

CREATE TABLE IF NOT EXISTS public.critic_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_channel_id text NOT NULL UNIQUE,
  name text NOT NULL,
  -- Mirrors critic_reviews.social_handle / .publication so an approved
  -- candidate can carry attribution straight across.
  social_handle text,
  publication text,
  avatar_url text,
  -- Cached from YouTube so polling costs 1 quota unit instead of a channel
  -- lookup followed by a playlist lookup on every pass.
  uploads_playlist_id text,
  is_enabled boolean NOT NULL DEFAULT true,
  -- Uploads published at or before this are ignored, so adding a channel does
  -- not enqueue its entire back catalogue on the first poll.
  baseline_at timestamptz NOT NULL DEFAULT now(),
  last_polled_at timestamptz,
  last_video_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS critic_channels_enabled_idx
  ON public.critic_channels(last_polled_at NULLS FIRST)
  WHERE is_enabled;

CREATE TABLE IF NOT EXISTS public.critic_review_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One row per video, forever. Re-discovery enriches this row in place rather
  -- than inserting a second candidate for the same review.
  video_id text NOT NULL UNIQUE,
  critic_channel_id uuid REFERENCES public.critic_channels(id) ON DELETE SET NULL,
  -- Null until the title matches a film. A candidate with no film is kept, not
  -- dropped: the film is often published after the review goes up.
  film_id uuid REFERENCES public.films(id) ON DELETE CASCADE,
  video_title text,
  video_published_at timestamptz,
  video_url text,

  status text NOT NULL DEFAULT 'pending_transcript',

  -- Punctuation-restored transcript the quote was selected from. Kept so a
  -- reviewer can see the surrounding argument, and so a disputed quote can be
  -- traced without re-fetching the video.
  transcript text,
  transcript_source text,

  quote text,
  excerpt_context text,
  rating numeric(3, 1),
  -- Offset of the quote in the video, for a ?t= deep link. This is what makes
  -- a video quote auditable: the reader hears the critic say it.
  quote_start_seconds integer,

  last_error text,
  attempts integer NOT NULL DEFAULT 0,
  reviewed_at timestamptz,
  -- The row in critic_reviews this candidate produced, once approved.
  critic_review_id uuid REFERENCES public.critic_reviews(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT critic_review_candidates_status_check CHECK (
    status IN ('pending_transcript', 'pending_review', 'approved', 'rejected', 'failed')
  ),
  CONSTRAINT critic_review_candidates_transcript_source_check CHECK (
    transcript_source IS NULL
    OR transcript_source IN ('captions', 'whisper')
  )
);

-- Queue drain: oldest pending work first.
CREATE INDEX IF NOT EXISTS critic_review_candidates_status_idx
  ON public.critic_review_candidates(status, created_at);

CREATE INDEX IF NOT EXISTS critic_review_candidates_film_idx
  ON public.critic_review_candidates(film_id)
  WHERE film_id IS NOT NULL;

ALTER TABLE public.critic_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.critic_review_candidates ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.critic_channels TO service_role;
GRANT ALL ON public.critic_review_candidates TO service_role;

-- Admin-only, both tables. Unlike critic_reviews there is no public read
-- policy: an unapproved candidate holds an unverified quote attributed to a
-- named person, which is exactly what must not be served.
DROP POLICY IF EXISTS "Allow admin access for critic_channels" ON public.critic_channels;
CREATE POLICY "Allow admin access for critic_channels"
  ON public.critic_channels
  FOR ALL
  USING (
    auth.role() = 'service_role' OR
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin')
  )
  WITH CHECK (
    auth.role() = 'service_role' OR
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin')
  );

DROP POLICY IF EXISTS "Allow admin access for critic_review_candidates" ON public.critic_review_candidates;
CREATE POLICY "Allow admin access for critic_review_candidates"
  ON public.critic_review_candidates
  FOR ALL
  USING (
    auth.role() = 'service_role' OR
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin')
  )
  WITH CHECK (
    auth.role() = 'service_role' OR
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin')
  );

COMMENT ON TABLE public.critic_review_candidates IS
  'Video critic reviews awaiting human approval. A quote here is exact to its transcript, not verified against the audio, so nothing is published from this table without review.';
COMMENT ON COLUMN public.critic_review_candidates.quote_start_seconds IS
  'Offset of the quote within the video, used to build an auditable ?t= deep link back to the moment the critic says it.';
COMMENT ON COLUMN public.critic_review_candidates.transcript_source IS
  'As reported by services/local-clipper /metadata: captions (a YouTube caption track) or whisper (its local faster-whisper fallback). The clipper also reports none and captions_unusable, neither of which carries a transcript to store.';
