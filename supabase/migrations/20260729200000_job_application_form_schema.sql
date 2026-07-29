-- Per-job configurable application forms + flexible answers storage.

alter table public.job_postings
  add column if not exists application_form jsonb not null default '{"fields":[]}'::jsonb;

alter table public.job_applications
  add column if not exists answers jsonb not null default '{}'::jsonb;

-- Legacy fixed columns become optional (answers is source of truth going forward)
alter table public.job_applications alter column introduction drop not null;
alter table public.job_applications alter column social_links drop not null;
alter table public.job_applications alter column portfolio_links drop not null;
alter table public.job_applications alter column content_idea drop not null;
alter table public.job_applications alter column location drop not null;
alter table public.job_applications alter column availability drop not null;

-- Seed / backfill the Social Media role with the previous fixed form shape
update public.job_postings
set application_form = $json${
  "fields": [
    { "id": "full_name", "label": "Full name", "type": "text", "required": true },
    { "id": "email", "label": "Email", "type": "email", "required": true },
    { "id": "phone", "label": "Phone", "type": "phone", "required": false, "placeholder": "Optional" },
    { "id": "location", "label": "Current location", "type": "text", "required": true, "placeholder": "City, country" },
    { "id": "availability", "label": "Availability", "type": "text", "required": true, "placeholder": "e.g. Available immediately" },
    { "id": "introduction", "label": "Short introduction", "type": "textarea", "required": true, "placeholder": "Why you’re interested in this role and MuviDB" },
    { "id": "social_links", "label": "Social accounts you manage", "type": "textarea", "required": true, "placeholder": "Links to TikTok, Instagram, X accounts…" },
    { "id": "portfolio_links", "label": "Portfolio examples", "type": "textarea", "required": true, "placeholder": "2–3 links to graphics or short videos" },
    { "id": "content_idea", "label": "Sample MuviDB content idea", "type": "textarea", "required": true, "placeholder": "A sample Instagram post or TikTok idea" },
    { "id": "resume", "label": "Resume", "type": "file", "required": true, "accept": ".pdf,.doc,.docx", "help": "PDF or Word, max 3 MB" }
  ]
}$json$::jsonb
where slug = 'junior-social-media-content-associate'
   or application_form = '{"fields":[]}'::jsonb
   or application_form is null
   or jsonb_array_length(coalesce(application_form->'fields', '[]'::jsonb)) = 0;

-- Broader mime types for portfolio images / zips when admins allow them
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/zip',
  'application/x-zip-compressed'
],
file_size_limit = 3145728
where id = 'job-resumes';
