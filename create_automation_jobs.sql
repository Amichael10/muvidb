-- Create the automation_jobs table to track background scripts
CREATE TABLE IF NOT EXISTS public.automation_jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'idle', -- 'idle', 'running', 'error'
  last_run TIMESTAMP WITH TIME ZONE,
  last_message TEXT
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.automation_jobs ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users (admin dashboard)
CREATE POLICY "Allow read access for authenticated users" ON public.automation_jobs
  FOR SELECT
  TO authenticated
  USING (true);

-- Optional: Initial seed data
INSERT INTO public.automation_jobs (id, status, last_message)
VALUES 
  ('actor_enricher', 'idle', 'Ready to run'),
  ('channel_fetcher', 'idle', 'Ready to run')
ON CONFLICT (id) DO NOTHING;
