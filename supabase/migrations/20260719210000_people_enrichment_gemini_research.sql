-- Grounded Gemini research for people enrichment.
-- Gemini may only create review proposals + evidence; never auto-write people.

ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS tiktok_url text;

CREATE TABLE IF NOT EXISTS public.people_enrichment_research_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NOT NULL REFERENCES public.people_enrichment_queue(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'gemini' CHECK (provider IN ('gemini', 'tmdb', 'tmdb_then_gemini')),
  model text NOT NULL,
  prompt_version text NOT NULL,
  status text NOT NULL CHECK (status IN (
    'running', 'completed', 'no_match', 'needs_review', 'failed', 'cached', 'budget_blocked'
  )),
  identity_confidence numeric CHECK (
    identity_confidence IS NULL OR identity_confidence BETWEEN 0 AND 1
  ),
  identity_reasons text[] NOT NULL DEFAULT '{}'::text[],
  search_queries text[] NOT NULL DEFAULT '{}'::text[],
  grounding_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  input_fingerprint text NOT NULL,
  token_usage jsonb NOT NULL DEFAULT '{}'::jsonb,
  estimated_cost numeric NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.people_enrichment_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NOT NULL REFERENCES public.people_enrichment_queue(id) ON DELETE CASCADE,
  research_run_id uuid REFERENCES public.people_enrichment_research_runs(id) ON DELETE SET NULL,
  field_name text NOT NULL,
  proposed_value text NOT NULL,
  source_url text NOT NULL,
  source_title text,
  source_domain text,
  source_tier smallint NOT NULL DEFAULT 5 CHECK (source_tier BETWEEN 1 AND 5),
  evidence_excerpt text,
  identity_anchor text,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  verification_status text NOT NULL DEFAULT 'proposed' CHECK (
    verification_status IN ('proposed', 'accepted', 'rejected', 'stale')
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS people_enrichment_research_runs_queue_idx
  ON public.people_enrichment_research_runs(queue_id, started_at DESC);
CREATE INDEX IF NOT EXISTS people_enrichment_research_runs_fingerprint_idx
  ON public.people_enrichment_research_runs(input_fingerprint, started_at DESC);
CREATE INDEX IF NOT EXISTS people_enrichment_research_runs_day_idx
  ON public.people_enrichment_research_runs(started_at DESC)
  WHERE provider = 'gemini';
CREATE INDEX IF NOT EXISTS people_enrichment_evidence_queue_field_idx
  ON public.people_enrichment_evidence(queue_id, field_name);

ALTER TABLE public.people_enrichment_research_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people_enrichment_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage people enrichment research runs"
  ON public.people_enrichment_research_runs;
CREATE POLICY "Admins manage people enrichment research runs"
  ON public.people_enrichment_research_runs
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role IN ('admin', 'admin_limited')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role IN ('admin', 'admin_limited')
  ));

DROP POLICY IF EXISTS "Admins manage people enrichment evidence"
  ON public.people_enrichment_evidence;
CREATE POLICY "Admins manage people enrichment evidence"
  ON public.people_enrichment_evidence
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role IN ('admin', 'admin_limited')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role IN ('admin', 'admin_limited')
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.people_enrichment_research_runs
  TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.people_enrichment_evidence
  TO authenticated, service_role;

-- Keep completeness tracking in sync with tiktok_url.
CREATE OR REPLACE FUNCTION public.refresh_people_enrichment_queue()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role IN ('admin', 'admin_limited')
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  INSERT INTO public.people_enrichment_queue (
    person_id,
    missing_fields,
    current_completeness,
    priority_score
  )
  SELECT
    p.id,
    array_remove(ARRAY[
      CASE WHEN NULLIF(trim(p.bio), '') IS NULL THEN 'bio' END,
      CASE WHEN NULLIF(trim(p.photo_url), '') IS NULL THEN 'photo_url' END,
      CASE WHEN p.date_of_birth IS NULL THEN 'date_of_birth' END,
      CASE WHEN NULLIF(trim(p.birthplace), '') IS NULL THEN 'birthplace' END,
      CASE WHEN NULLIF(trim(p.known_for_department), '') IS NULL THEN 'known_for_department' END,
      CASE WHEN NULLIF(trim(p.instagram_url), '') IS NULL THEN 'instagram_url' END,
      CASE WHEN NULLIF(trim(p.facebook_url), '') IS NULL THEN 'facebook_url' END,
      CASE WHEN NULLIF(trim(p.twitter_url), '') IS NULL THEN 'twitter_url' END,
      CASE WHEN NULLIF(trim(p.tiktok_url), '') IS NULL THEN 'tiktok_url' END,
      CASE WHEN p.tmdb_id IS NULL THEN 'tmdb_id' END
    ], NULL),
    (
      CASE WHEN NULLIF(trim(p.photo_url), '') IS NOT NULL THEN 20 ELSE 0 END +
      CASE WHEN NULLIF(trim(p.bio), '') IS NOT NULL THEN 20 ELSE 0 END +
      CASE WHEN p.date_of_birth IS NOT NULL THEN 12 ELSE 0 END +
      CASE WHEN NULLIF(trim(p.birthplace), '') IS NOT NULL THEN 8 ELSE 0 END +
      CASE WHEN NULLIF(trim(p.known_for_department), '') IS NOT NULL THEN 8 ELSE 0 END +
      CASE WHEN NULLIF(trim(p.instagram_url), '') IS NOT NULL THEN 10 ELSE 0 END +
      CASE WHEN NULLIF(trim(p.facebook_url), '') IS NOT NULL THEN 4 ELSE 0 END +
      CASE WHEN NULLIF(trim(p.twitter_url), '') IS NOT NULL THEN 4 ELSE 0 END +
      CASE WHEN NULLIF(trim(p.tiktok_url), '') IS NOT NULL THEN 2 ELSE 0 END +
      CASE WHEN p.tmdb_id IS NOT NULL THEN 12 ELSE 0 END
    )::smallint,
    (
      COALESCE(p.popularity_score, 0) * 4 +
      LEAST(COALESCE(p.film_count, 0), 60) * 6 +
      LEAST(COALESCE(p.profile_views, 0), 10000) / 50.0 +
      CASE WHEN p.is_verified THEN 120 ELSE 0 END +
      CASE WHEN COALESCE(p.is_spotlight, false) THEN 150 ELSE 0 END +
      CASE WHEN p.claimed_by IS NOT NULL THEN 200 ELSE 0 END +
      -- Prefer people who already have credits but lack photos/bios/socials.
      CASE
        WHEN COALESCE(p.film_count, 0) > 0
          AND (
            NULLIF(trim(p.bio), '') IS NULL
            OR NULLIF(trim(p.photo_url), '') IS NULL
            OR NULLIF(trim(p.instagram_url), '') IS NULL
          )
        THEN 80
        ELSE 0
      END -
      -- Deprioritize already-complete profiles.
      CASE
        WHEN NULLIF(trim(p.bio), '') IS NOT NULL
          AND NULLIF(trim(p.photo_url), '') IS NOT NULL
          AND (
            NULLIF(trim(p.instagram_url), '') IS NOT NULL
            OR NULLIF(trim(p.twitter_url), '') IS NOT NULL
            OR NULLIF(trim(p.facebook_url), '') IS NOT NULL
          )
        THEN 500
        ELSE 0
      END
    )::numeric
  FROM public.people p
  WHERE
    NULLIF(trim(p.bio), '') IS NULL
    OR NULLIF(trim(p.photo_url), '') IS NULL
    OR p.date_of_birth IS NULL
    OR NULLIF(trim(p.birthplace), '') IS NULL
    OR NULLIF(trim(p.known_for_department), '') IS NULL
    OR NULLIF(trim(p.instagram_url), '') IS NULL
    OR NULLIF(trim(p.facebook_url), '') IS NULL
    OR NULLIF(trim(p.twitter_url), '') IS NULL
    OR NULLIF(trim(p.tiktok_url), '') IS NULL
    OR p.tmdb_id IS NULL
  ON CONFLICT (person_id) DO UPDATE SET
    missing_fields = EXCLUDED.missing_fields,
    current_completeness = EXCLUDED.current_completeness,
    priority_score = EXCLUDED.priority_score,
    status = CASE
      WHEN people_enrichment_queue.status = 'failed' THEN 'pending'
      ELSE people_enrichment_queue.status
    END;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_people_enrichment_completeness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.people_enrichment_queue
  SET
    missing_fields = array_remove(ARRAY[
      CASE WHEN NULLIF(trim(NEW.bio), '') IS NULL THEN 'bio' END,
      CASE WHEN NULLIF(trim(NEW.photo_url), '') IS NULL THEN 'photo_url' END,
      CASE WHEN NEW.date_of_birth IS NULL THEN 'date_of_birth' END,
      CASE WHEN NULLIF(trim(NEW.birthplace), '') IS NULL THEN 'birthplace' END,
      CASE WHEN NULLIF(trim(NEW.known_for_department), '') IS NULL THEN 'known_for_department' END,
      CASE WHEN NULLIF(trim(NEW.instagram_url), '') IS NULL THEN 'instagram_url' END,
      CASE WHEN NULLIF(trim(NEW.facebook_url), '') IS NULL THEN 'facebook_url' END,
      CASE WHEN NULLIF(trim(NEW.twitter_url), '') IS NULL THEN 'twitter_url' END,
      CASE WHEN NULLIF(trim(NEW.tiktok_url), '') IS NULL THEN 'tiktok_url' END,
      CASE WHEN NEW.tmdb_id IS NULL THEN 'tmdb_id' END
    ], NULL),
    current_completeness = (
      CASE WHEN NULLIF(trim(NEW.photo_url), '') IS NOT NULL THEN 20 ELSE 0 END +
      CASE WHEN NULLIF(trim(NEW.bio), '') IS NOT NULL THEN 20 ELSE 0 END +
      CASE WHEN NEW.date_of_birth IS NOT NULL THEN 12 ELSE 0 END +
      CASE WHEN NULLIF(trim(NEW.birthplace), '') IS NOT NULL THEN 8 ELSE 0 END +
      CASE WHEN NULLIF(trim(NEW.known_for_department), '') IS NOT NULL THEN 8 ELSE 0 END +
      CASE WHEN NULLIF(trim(NEW.instagram_url), '') IS NOT NULL THEN 10 ELSE 0 END +
      CASE WHEN NULLIF(trim(NEW.facebook_url), '') IS NOT NULL THEN 4 ELSE 0 END +
      CASE WHEN NULLIF(trim(NEW.twitter_url), '') IS NOT NULL THEN 4 ELSE 0 END +
      CASE WHEN NULLIF(trim(NEW.tiktok_url), '') IS NOT NULL THEN 2 ELSE 0 END +
      CASE WHEN NEW.tmdb_id IS NOT NULL THEN 12 ELSE 0 END
    )::smallint
  WHERE person_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS people_enrichment_completeness_after_update ON public.people;
CREATE TRIGGER people_enrichment_completeness_after_update
  AFTER UPDATE OF
    bio, photo_url, date_of_birth, birthplace, known_for_department,
    instagram_url, facebook_url, twitter_url, tiktok_url, tmdb_id
  ON public.people
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_people_enrichment_completeness();

CREATE OR REPLACE FUNCTION public.apply_people_enrichment_candidate(
  p_queue_id uuid,
  p_fields text[],
  p_reviewer_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q public.people_enrichment_queue%ROWTYPE;
  person_before public.people%ROWTYPE;
  person_after public.people%ROWTYPE;
  reviewer_id uuid;
  allowed_fields constant text[] := ARRAY[
    'bio', 'photo_url', 'date_of_birth', 'birthplace', 'nationality', 'gender',
    'known_for_department', 'instagram_url', 'facebook_url', 'twitter_url',
    'tiktok_url', 'youtube_channel_id', 'youtube_handle', 'tmdb_id'
  ];
BEGIN
  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role IN ('admin', 'admin_limited')
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_fields IS NULL OR cardinality(p_fields) = 0 THEN
    RAISE EXCEPTION 'Select at least one proposed field';
  END IF;
  reviewer_id := CASE WHEN auth.role() = 'service_role' THEN p_reviewer_id ELSE auth.uid() END;
  IF EXISTS (
    SELECT 1
    FROM unnest(p_fields) AS selected(field_name)
    WHERE NOT field_name = ANY(allowed_fields)
  ) THEN
    RAISE EXCEPTION 'One or more selected fields cannot be enriched';
  END IF;

  SELECT * INTO q
  FROM public.people_enrichment_queue
  WHERE id = p_queue_id
  FOR UPDATE;
  IF q.id IS NULL THEN RAISE EXCEPTION 'Enrichment candidate not found'; END IF;
  IF q.status NOT IN ('ready', 'needs_review') THEN
    RAISE EXCEPTION 'This candidate is not ready for approval';
  END IF;

  SELECT * INTO person_before
  FROM public.people
  WHERE id = q.person_id
  FOR UPDATE;
  IF person_before.id IS NULL THEN RAISE EXCEPTION 'Person profile not found'; END IF;

  IF 'tmdb_id' = ANY(p_fields)
     AND NULLIF(q.candidate_data->>'tmdb_id', '') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.people
       WHERE tmdb_id = (q.candidate_data->>'tmdb_id')::integer
         AND id <> q.person_id
     ) THEN
    RAISE EXCEPTION 'TMDB identity is already attached to another profile; resolve the duplicate first';
  END IF;

  UPDATE public.people
  SET
    bio = CASE WHEN 'bio' = ANY(p_fields) AND NULLIF(q.candidate_data->>'bio', '') IS NOT NULL THEN q.candidate_data->>'bio' ELSE bio END,
    photo_url = CASE WHEN 'photo_url' = ANY(p_fields) AND NULLIF(q.candidate_data->>'photo_url', '') IS NOT NULL THEN q.candidate_data->>'photo_url' ELSE photo_url END,
    date_of_birth = CASE WHEN 'date_of_birth' = ANY(p_fields) AND NULLIF(q.candidate_data->>'date_of_birth', '') IS NOT NULL THEN (q.candidate_data->>'date_of_birth')::date ELSE date_of_birth END,
    birthplace = CASE WHEN 'birthplace' = ANY(p_fields) AND NULLIF(q.candidate_data->>'birthplace', '') IS NOT NULL THEN q.candidate_data->>'birthplace' ELSE birthplace END,
    nationality = CASE WHEN 'nationality' = ANY(p_fields) AND NULLIF(q.candidate_data->>'nationality', '') IS NOT NULL THEN q.candidate_data->>'nationality' ELSE nationality END,
    gender = CASE WHEN 'gender' = ANY(p_fields) AND NULLIF(q.candidate_data->>'gender', '') IS NOT NULL THEN q.candidate_data->>'gender' ELSE gender END,
    known_for_department = CASE WHEN 'known_for_department' = ANY(p_fields) AND NULLIF(q.candidate_data->>'known_for_department', '') IS NOT NULL THEN q.candidate_data->>'known_for_department' ELSE known_for_department END,
    instagram_url = CASE WHEN 'instagram_url' = ANY(p_fields) AND NULLIF(q.candidate_data->>'instagram_url', '') IS NOT NULL THEN q.candidate_data->>'instagram_url' ELSE instagram_url END,
    facebook_url = CASE WHEN 'facebook_url' = ANY(p_fields) AND NULLIF(q.candidate_data->>'facebook_url', '') IS NOT NULL THEN q.candidate_data->>'facebook_url' ELSE facebook_url END,
    twitter_url = CASE WHEN 'twitter_url' = ANY(p_fields) AND NULLIF(q.candidate_data->>'twitter_url', '') IS NOT NULL THEN q.candidate_data->>'twitter_url' ELSE twitter_url END,
    tiktok_url = CASE WHEN 'tiktok_url' = ANY(p_fields) AND NULLIF(q.candidate_data->>'tiktok_url', '') IS NOT NULL THEN q.candidate_data->>'tiktok_url' ELSE tiktok_url END,
    youtube_channel_id = CASE WHEN 'youtube_channel_id' = ANY(p_fields) AND NULLIF(q.candidate_data->>'youtube_channel_id', '') IS NOT NULL THEN q.candidate_data->>'youtube_channel_id' ELSE youtube_channel_id END,
    youtube_handle = CASE WHEN 'youtube_handle' = ANY(p_fields) AND NULLIF(q.candidate_data->>'youtube_handle', '') IS NOT NULL THEN q.candidate_data->>'youtube_handle' ELSE youtube_handle END,
    tmdb_id = CASE WHEN 'tmdb_id' = ANY(p_fields) AND NULLIF(q.candidate_data->>'tmdb_id', '') IS NOT NULL THEN (q.candidate_data->>'tmdb_id')::integer ELSE tmdb_id END,
    updated_at = now()
  WHERE id = q.person_id
  RETURNING * INTO person_after;

  INSERT INTO public.people_enrichment_history (
    queue_id, person_id, action, changed_fields, previous_data,
    proposed_data, source_details, reviewed_by
  ) VALUES (
    q.id, q.person_id, 'applied', p_fields, to_jsonb(person_before),
    q.candidate_data, q.field_sources || jsonb_build_object(
      'source_name', q.source_name,
      'source_url', q.source_url,
      'match_confidence', q.match_confidence,
      'match_reasons', q.match_reasons,
      'matched_credits', q.matched_credits,
      'provider', COALESCE(q.source_name, 'unknown'),
      'approving_admin', reviewer_id
    ), reviewer_id
  );

  UPDATE public.people_enrichment_evidence
  SET verification_status = 'accepted'
  WHERE queue_id = q.id
    AND field_name = ANY(p_fields)
    AND verification_status = 'proposed';

  UPDATE public.people_enrichment_queue
  SET status = 'applied', reviewed_by = reviewer_id, reviewed_at = now()
  WHERE id = q.id;

  RETURN to_jsonb(person_after);
END;
$$;

COMMENT ON TABLE public.people_enrichment_research_runs IS
  'Audited Gemini/TMDB research runs for people enrichment proposals.';
COMMENT ON TABLE public.people_enrichment_evidence IS
  'Per-field citation evidence backing enrichment proposals. Gemini claims without evidence are rejected.';
