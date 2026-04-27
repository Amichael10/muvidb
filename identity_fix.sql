-- 1. Ensure public.users has the right columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Enforce one profile per email
-- First, clean up any existing duplicates (keeping the oldest profile)
DELETE FROM public.users a
USING public.users b
WHERE a.ctid > b.ctid AND a.email = b.email;

-- Add the unique constraint to the users table
-- If it already exists, this might error, so wrap in a safe way if needed, 
-- but normally for a clean script we just write:
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);

-- 3. Create the automated handle_new_user trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url, role)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(
      new.raw_user_meta_data->>'name', 
      new.raw_user_meta_data->>'full_name', 
      split_part(new.email, '@', 1),
      'User'
    ), 
    COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    COALESCE(new.raw_user_meta_data->>'role', 'fan')
  )
  ON CONFLICT (email) DO UPDATE SET
    -- CRITICAL: We do NOT update the ID to avoid breaking foreign key relationships (films/credits/reviews)
    name = COALESCE(EXCLUDED.name, public.users.name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url);
    -- Note: Role is NOT updated to preserve administrative or professional status
    
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Set up the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
