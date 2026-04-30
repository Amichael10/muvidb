CREATE TABLE IF NOT EXISTS public.spotlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  photo_url TEXT,
  story TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.spotlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to spotlights" ON public.spotlights FOR SELECT USING (true);
CREATE POLICY "Allow authenticated full access to spotlights" ON public.spotlights FOR ALL USING (auth.role() = 'authenticated');
