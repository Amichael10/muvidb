-- Add Box Office and Financial metrics to public.films
ALTER TABLE public.films 
ADD COLUMN IF NOT EXISTS budget NUMERIC(15, 2),
ADD COLUMN IF NOT EXISTS box_office_domestic NUMERIC(15, 2),
ADD COLUMN IF NOT EXISTS box_office_worldwide NUMERIC(15, 2),
ADD COLUMN IF NOT EXISTS box_office_opening_weekend NUMERIC(15, 2),
ADD COLUMN IF NOT EXISTS box_office_currency VARCHAR(10) DEFAULT 'NGN',
ADD COLUMN IF NOT EXISTS box_office_source TEXT,
ADD COLUMN IF NOT EXISTS box_office_updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for Box Office sorting
CREATE INDEX IF NOT EXISTS idx_films_box_office_domestic ON public.films(box_office_domestic DESC NULLS LAST);
