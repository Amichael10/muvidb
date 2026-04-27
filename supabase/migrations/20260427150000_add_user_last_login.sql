-- Migration: Add last_sign_in_at to public.users and sync from auth.users
-- Date: 2026-04-27

-- 1. Add column to public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ;

-- 2. Update the sync function to handle updates as well
CREATE OR REPLACE FUNCTION public.handle_user_sync() 
RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.users (id, email, name, avatar_url, role, last_sign_in_at)
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
      COALESCE(new.raw_user_meta_data->>'role', 'fan'),
      new.last_sign_in_at
    )
    ON CONFLICT (email) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, public.users.name),
      avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
      last_sign_in_at = EXCLUDED.last_sign_in_at;
  ELSIF (TG_OP = 'UPDATE') THEN
    UPDATE public.users 
    SET 
      last_sign_in_at = new.last_sign_in_at,
      email = new.email,
      name = COALESCE(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', public.users.name),
      avatar_url = COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', public.users.avatar_url)
    WHERE id = new.id;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Re-set the insert trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_user_sync();

-- 4. Add the update trigger to sync last_sign_in_at
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF last_sign_in_at, email, raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_user_sync();

-- 5. Backfill existing last_sign_in_at values
UPDATE public.users u
SET last_sign_in_at = a.last_sign_in_at
FROM auth.users a
WHERE u.id = a.id;
