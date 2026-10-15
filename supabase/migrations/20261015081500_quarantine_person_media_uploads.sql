INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('person-media-pending', 'person-media-pending', false, 33554432,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
ON CONFLICT(id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.person_media_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by uuid NOT NULL REFERENCES public.users(id),
  person_id uuid NOT NULL REFERENCES public.people(id),
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size > 0 AND byte_size <= 33554432),
  approved_url text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.person_media_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.person_media_uploads FROM anon, authenticated;
GRANT ALL ON public.person_media_uploads TO service_role;
CREATE INDEX IF NOT EXISTS person_media_uploads_owner_idx ON public.person_media_uploads(uploaded_by, created_at);

-- Browser clients can read approved media. All writes and pending previews go
-- through the authenticated API, which enforces moderation and private storage.
REVOKE INSERT, UPDATE, DELETE ON public.person_media FROM anon, authenticated;
