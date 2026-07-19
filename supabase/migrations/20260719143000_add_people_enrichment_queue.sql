-- Review-first people enrichment. Automated sources may propose values, but
-- only an authenticated admin can apply selected fields to public profiles.

CREATE TABLE IF NOT EXISTS public.people_enrichment_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL UNIQUE REFERENCES public.people(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'fetching', 'ready', 'needs_review', 'no_match',
    'applied', 'skipped', 'failed'
  )),
  missing_fields text[] NOT NULL DEFAULT '{}'::text[],
  current_completeness smallint NOT NULL DEFAULT 0 CHECK (current_completeness BETWEEN 0 AND 100),
  priority_score numeric NOT NULL DEFAULT 0,
  candidate_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  field_sources jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_name text,
  source_record_id text,
  source_url text,
  match_confidence numeric CHECK (match_confidence IS NULL OR match_confidence BETWEEN 0 AND 1),
  match_reasons text[] NOT NULL DEFAULT '{}'::text[],
  matched_credits text[] NOT NULL DEFAULT '{}'::text[],
  reviewer_note text,
  attempt_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.people_enrichment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid REFERENCES public.people_enrichment_queue(id) ON DELETE SET NULL,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('applied', 'skipped', 'reopened', 'candidate_replaced')),
  changed_fields text[] NOT NULL DEFAULT '{}'::text[],
  previous_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  proposed_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS people_enrichment_queue_review_idx
  ON public.people_enrichment_queue(status, priority_score DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS people_enrichment_history_person_idx
  ON public.people_enrichment_history(person_id, created_at DESC);

DROP TRIGGER IF EXISTS people_enrichment_queue_updated_at ON public.people_enrichment_queue;
CREATE TRIGGER people_enrichment_queue_updated_at
  BEFORE UPDATE ON public.people_enrichment_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.people_enrichment_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people_enrichment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage people enrichment queue" ON public.people_enrichment_queue;
CREATE POLICY "Admins manage people enrichment queue"
  ON public.people_enrichment_queue
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role IN ('admin', 'admin_limited')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role IN ('admin', 'admin_limited')
  ));

DROP POLICY IF EXISTS "Admins read people enrichment history" ON public.people_enrichment_history;
CREATE POLICY "Admins read people enrichment history"
  ON public.people_enrichment_history
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role IN ('admin', 'admin_limited')
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.people_enrichment_queue TO authenticated;
GRANT SELECT ON public.people_enrichment_history TO authenticated;

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
      CASE WHEN p.tmdb_id IS NULL THEN 'tmdb_id' END
    ], NULL),
    (
      CASE WHEN NULLIF(trim(p.photo_url), '') IS NOT NULL THEN 20 ELSE 0 END +
      CASE WHEN NULLIF(trim(p.bio), '') IS NOT NULL THEN 20 ELSE 0 END +
      CASE WHEN p.date_of_birth IS NOT NULL THEN 12 ELSE 0 END +
      CASE WHEN NULLIF(trim(p.birthplace), '') IS NOT NULL THEN 8 ELSE 0 END +
      CASE WHEN NULLIF(trim(p.known_for_department), '') IS NOT NULL THEN 8 ELSE 0 END +
      CASE WHEN NULLIF(trim(p.instagram_url), '') IS NOT NULL THEN 10 ELSE 0 END +
      CASE WHEN NULLIF(trim(p.facebook_url), '') IS NOT NULL THEN 5 ELSE 0 END +
      CASE WHEN NULLIF(trim(p.twitter_url), '') IS NOT NULL THEN 5 ELSE 0 END +
      CASE WHEN p.tmdb_id IS NOT NULL THEN 12 ELSE 0 END
    )::smallint,
    (
      COALESCE(p.popularity_score, 0) * 4 +
      LEAST(COALESCE(p.film_count, 0), 60) * 6 +
      LEAST(COALESCE(p.profile_views, 0), 10000) / 50.0 +
      CASE WHEN p.is_verified THEN 120 ELSE 0 END +
      CASE WHEN COALESCE(p.is_spotlight, false) THEN 150 ELSE 0 END +
      CASE WHEN p.claimed_by IS NOT NULL THEN 200 ELSE 0 END
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
    'youtube_channel_id', 'youtube_handle', 'tmdb_id'
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
      'matched_credits', q.matched_credits
    ), reviewer_id
  );

  UPDATE public.people_enrichment_queue
  SET status = 'applied', reviewed_by = reviewer_id, reviewed_at = now()
  WHERE id = q.id;

  RETURN to_jsonb(person_after);
END;
$$;

CREATE OR REPLACE FUNCTION public.review_people_enrichment_candidate(
  p_queue_id uuid,
  p_status text,
  p_note text DEFAULT NULL,
  p_reviewer_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q public.people_enrichment_queue%ROWTYPE;
  reviewer_id uuid;
  history_action text;
BEGIN
  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role IN ('admin', 'admin_limited')
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_status NOT IN ('skipped', 'pending') THEN
    RAISE EXCEPTION 'Invalid review decision';
  END IF;

  SELECT * INTO q
  FROM public.people_enrichment_queue
  WHERE id = p_queue_id
  FOR UPDATE;
  IF q.id IS NULL THEN RAISE EXCEPTION 'Enrichment candidate not found'; END IF;

  reviewer_id := CASE WHEN auth.role() = 'service_role' THEN p_reviewer_id ELSE auth.uid() END;
  history_action := CASE WHEN p_status = 'skipped' THEN 'skipped' ELSE 'reopened' END;

  INSERT INTO public.people_enrichment_history (
    queue_id, person_id, action, proposed_data, source_details, note, reviewed_by
  ) VALUES (
    q.id,
    q.person_id,
    history_action,
    q.candidate_data,
    q.field_sources || jsonb_build_object(
      'source_name', q.source_name,
      'source_url', q.source_url,
      'match_confidence', q.match_confidence,
      'match_reasons', q.match_reasons,
      'matched_credits', q.matched_credits
    ),
    NULLIF(trim(p_note), ''),
    reviewer_id
  );

  UPDATE public.people_enrichment_queue
  SET
    status = p_status,
    reviewer_note = NULLIF(trim(p_note), ''),
    reviewed_by = reviewer_id,
    reviewed_at = now(),
    candidate_data = CASE WHEN p_status = 'pending' THEN '{}'::jsonb ELSE candidate_data END,
    field_sources = CASE WHEN p_status = 'pending' THEN '{}'::jsonb ELSE field_sources END,
    match_confidence = CASE WHEN p_status = 'pending' THEN NULL ELSE match_confidence END,
    match_reasons = CASE WHEN p_status = 'pending' THEN '{}'::text[] ELSE match_reasons END,
    matched_credits = CASE WHEN p_status = 'pending' THEN '{}'::text[] ELSE matched_credits END,
    source_record_id = CASE WHEN p_status = 'pending' THEN NULL ELSE source_record_id END,
    source_url = CASE WHEN p_status = 'pending' THEN NULL ELSE source_url END
  WHERE id = q.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refresh_people_enrichment_queue() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.apply_people_enrichment_candidate(uuid, text[], uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.review_people_enrichment_candidate(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_people_enrichment_queue() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_people_enrichment_candidate(uuid, text[], uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.review_people_enrichment_candidate(uuid, text, text, uuid) TO authenticated, service_role;

COMMENT ON TABLE public.people_enrichment_queue IS 'Sourced actor and crew metadata proposals awaiting human review.';
COMMENT ON TABLE public.people_enrichment_history IS 'Immutable audit trail for applied or dismissed people enrichment proposals.';
