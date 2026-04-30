
-- Create sync_logs table
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  source TEXT NOT NULL, -- 'youtube', 'tmdb', 'showtimes', etc.
  status TEXT NOT NULL, -- 'success', 'error', 'partial'
  message TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  duration_ms INTEGER,
  items_processed INTEGER DEFAULT 0,
  items_created INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0
);

-- Enable RLS on sync_logs
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- Allow admins to read logs
CREATE POLICY "Admins can read sync logs"
  ON public.sync_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Fix the handle_new_user trigger to be more robust
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_role TEXT;
BEGIN
  -- Get name with fallbacks
  v_name := COALESCE(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1),
    'User'
  );

  -- Normalize role to valid enum values
  v_role := CASE 
    WHEN (new.raw_user_meta_data->>'role') = 'admin' THEN 'admin'
    WHEN (new.raw_user_meta_data->>'role') IN ('professional', 'pro', 'industry') THEN 'professional'
    ELSE 'fan'
  END;

  INSERT INTO public.users (id, email, name, role)
  VALUES (
    new.id,
    new.email,
    v_name,
    v_role::user_role
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role;
    
  RETURN new;
END;
$$;
