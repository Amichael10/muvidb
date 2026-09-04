-- Canonical people aliases for OCR and distributor/channel name variants.
-- Bracketed credit names such as "Ibrahim Yekini (Itele)" are ingested as
-- canonical name + alias, instead of becoming a second person.

CREATE OR REPLACE FUNCTION public.person_alias_key(value text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public
AS $$
  SELECT NULLIF(regexp_replace(lower(trim(coalesce(value, ''))), '[^a-z0-9]+', '', 'g'), '');
$$;

CREATE TABLE IF NOT EXISTS public.person_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  alias text NOT NULL CHECK (length(trim(alias)) > 0),
  alias_key text GENERATED ALWAYS AS (public.person_alias_key(alias)) STORED,
  source text,
  confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT person_aliases_person_alias_key_uniq UNIQUE (person_id, alias_key)
);

CREATE INDEX IF NOT EXISTS person_aliases_alias_key_idx ON public.person_aliases(alias_key);
CREATE INDEX IF NOT EXISTS person_aliases_person_id_idx ON public.person_aliases(person_id);

ALTER TABLE public.person_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read person aliases" ON public.person_aliases;
CREATE POLICY "Authenticated users can read person aliases" ON public.person_aliases FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage person aliases" ON public.person_aliases;
CREATE POLICY "Admins can manage person aliases" ON public.person_aliases FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Backfill aliases before cleaning the display name. Duplicate aliases on the
-- same person are ignored, so this migration is safe to re-run.
INSERT INTO public.person_aliases (person_id, alias, source)
SELECT p.id, trim(coalesce(match[1], match[2])), 'legacy-bracketed-name'
FROM public.people p
CROSS JOIN LATERAL regexp_matches(p.name, '\(([^()]+)\)|\[([^\]]+)\]', 'g') AS match
WHERE trim(coalesce(match[1], match[2])) <> ''
ON CONFLICT (person_id, alias_key) DO NOTHING;

UPDATE public.people
SET name = trim(regexp_replace(regexp_replace(name, '\([^()]+\)', '', 'g'), '\[[^\]]+\]', '', 'g'))
WHERE name ~ '\([^()]+\)|\[[^\]]+\]';

CREATE OR REPLACE FUNCTION public.find_person_by_name(p_name text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH input AS (
    SELECT trim(coalesce(p_name, '')) AS raw,
           trim(regexp_replace(regexp_replace(coalesce(p_name, ''), '\([^()]+\)', '', 'g'), '\[[^\]]+\]', '', 'g')) AS canonical,
           public.person_name_key(p_name) AS name_key,
           public.person_alias_key(regexp_replace(regexp_replace(coalesce(p_name, ''), '.*\(([^()]+)\).*', '\1'), '.*\[([^\]]+)\].*', '\1')) AS alias_key
  )
  SELECT p.id FROM public.people p CROSS JOIN input i
  WHERE lower(p.name) = lower(i.canonical)
     OR (i.name_key IS NOT NULL AND p.name_key = i.name_key)
     OR EXISTS (SELECT 1 FROM public.person_aliases a WHERE a.person_id = p.id AND a.alias_key = i.alias_key)
  ORDER BY CASE WHEN lower(p.name) = lower(i.canonical) THEN 0 WHEN EXISTS (SELECT 1 FROM public.person_aliases a WHERE a.person_id = p.id AND a.alias_key = i.alias_key) THEN 1 ELSE 2 END,
           (SELECT count(*) FROM public.credits c WHERE c.person_id = p.id) DESC, p.created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.upsert_person_by_name(p_name text, p_extra jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid; v_raw text := trim(coalesce(p_name, '')); v_name text; v_alias text;
BEGIN
  IF v_raw = '' THEN RETURN NULL; END IF;
  v_name := trim(regexp_replace(regexp_replace(v_raw, '\([^()]+\)', '', 'g'), '\[[^\]]+\]', '', 'g'));
  v_alias := NULLIF(trim(substring(v_raw FROM '\(([^()]+)\)')), '');
  IF v_alias IS NULL THEN v_alias := NULLIF(trim(substring(v_raw FROM '\[([^\]]+)\]')), ''); END IF;
  v_id := public.find_person_by_name(v_raw);
  IF v_id IS NULL THEN
    INSERT INTO public.people (name, nationality, source, photo_url, known_for_department)
    VALUES (v_name, coalesce(nullif(p_extra->>'nationality',''), 'Nigerian'), nullif(p_extra->>'source',''), nullif(p_extra->>'photo_url',''), nullif(p_extra->>'known_for_department',''))
    RETURNING id INTO v_id;
  END IF;
  IF v_alias IS NOT NULL THEN INSERT INTO public.person_aliases(person_id, alias, source) VALUES (v_id, v_alias, coalesce(nullif(p_extra->>'source',''), 'ingestion')) ON CONFLICT (person_id, alias_key) DO NOTHING; END IF;
  RETURN v_id;
EXCEPTION WHEN unique_violation THEN RETURN public.find_person_by_name(v_raw);
END;
$$;

GRANT EXECUTE ON FUNCTION public.person_alias_key(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_person_by_name(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_person_by_name(text, jsonb) TO authenticated, service_role;
