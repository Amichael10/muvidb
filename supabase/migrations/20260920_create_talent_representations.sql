-- Create talent_representations table for agency/manager representation (IMDbPro style)
CREATE TABLE IF NOT EXISTS talent_representations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  representation_type TEXT NOT NULL DEFAULT 'Talent Agency', -- 'Talent Agency', 'Management', 'Publicist', 'Legal'
  agent_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  booking_url TEXT,
  is_primary BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (person_id, company_id, representation_type)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_talent_representations_person ON talent_representations(person_id);
CREATE INDEX IF NOT EXISTS idx_talent_representations_company ON talent_representations(company_id);

-- Enable RLS
ALTER TABLE talent_representations ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Public read access for talent_representations"
  ON talent_representations FOR SELECT
  USING (true);

-- Allow authenticated users / service role full write access
CREATE POLICY "Service role write access for talent_representations"
  ON talent_representations FOR ALL
  TO authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions to standard Supabase roles
GRANT ALL ON talent_representations TO anon, authenticated, service_role;
