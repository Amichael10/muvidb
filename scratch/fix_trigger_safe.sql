-- Recreate sync_logs table if not exists to be safe
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  duration_ms INTEGER,
  items_processed INTEGER DEFAULT 0,
  items_created INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0
);

-- Recreate trigger function with EXCEPTION block to prevent failing the entire signup transaction
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
    WHEN (new.raw_user_meta_data->>'role') = 'admin_limited' THEN 'admin_limited'
    WHEN (new.raw_user_meta_data->>'role') IN ('professional', 'pro', 'industry') THEN 'professional'
    ELSE 'fan'
  END;

  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    -- Capture error gracefully to sync_logs so the signup transaction still completes
    INSERT INTO public.sync_logs (source, status, message, details)
    VALUES (
      'handle_new_user_trigger',
      'error',
      SQLERRM,
      jsonb_build_object(
        'user_id', new.id,
        'email', new.email,
        'metadata', new.raw_user_meta_data,
        'sqlstate', SQLSTATE
      )
    );
  END;
    
  RETURN new;
END;
$$;
