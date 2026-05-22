-- Add mubi_slug to people, companies, channels
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS mubi_slug TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS mubi_slug TEXT;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS mubi_slug TEXT;

CREATE INDEX IF NOT EXISTS idx_people_mubi_slug ON public.people(mubi_slug);
CREATE INDEX IF NOT EXISTS idx_companies_mubi_slug ON public.companies(mubi_slug);
CREATE INDEX IF NOT EXISTS idx_channels_mubi_slug ON public.channels(mubi_slug);
