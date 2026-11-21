-- Migration: Talent Casting & Physical Attributes Store
-- Powers casting director specs, talent discovery, and the public Creator Link casting card.

CREATE TABLE IF NOT EXISTS public.casting_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Physical Attributes
  height_cm INTEGER,
  height_feet_inches TEXT,
  body_type TEXT, -- 'Athletic', 'Slim', 'Average', 'Muscular', 'Curvy', 'Plus Size'
  skin_tone TEXT, -- 'Fair', 'Caramel / Olive', 'Warm Brown', 'Deep Bronze', 'Dark / Ebony'
  hair_color TEXT, -- 'Black', 'Dark Brown', 'Brown', 'Auburn', 'Grey / Silver', 'Bald / Shaved'
  eye_color TEXT, -- 'Dark Brown', 'Brown', 'Hazel', 'Amber', 'Black'
  distinguishing_features TEXT, -- Scars, tattoos, dimples, facial hair, etc.
  
  -- Playing Age & Location
  playing_age_min INTEGER DEFAULT 20,
  playing_age_max INTEGER DEFAULT 35,
  location TEXT, -- e.g. 'Lagos, Nigeria', 'London, UK'
  willing_to_travel BOOLEAN DEFAULT true,
  
  -- Skills & Languages
  languages TEXT[] DEFAULT ARRAY['English']::TEXT[],
  skills TEXT[] DEFAULT '{}'::TEXT[], -- e.g. 'Stage Combat', 'Voiceover', 'Accents (British RP, Igbo, Yoruba)'
  
  -- Professional Status & Availability
  experience_level TEXT DEFAULT 'Professional', -- 'Professional', 'Semi-Professional', 'Emerging Talent', 'Student'
  availability_status TEXT DEFAULT 'Available for Bookings', -- 'Available for Bookings', 'Available with Notice', 'Currently on Production'
  preferences TEXT, -- Roles or project types preferred (e.g. 'Feature Films, High-End TV Drama, Lead / Supporting')
  union_memberships TEXT[] DEFAULT '{}'::TEXT[], -- e.g. 'AGN (Actors Guild of Nigeria)', 'Equity UK'
  
  -- Visibility Controls
  show_on_creator_link BOOLEAN DEFAULT true,
  show_on_person_page BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT casting_profiles_person_unique UNIQUE (person_id)
);

CREATE INDEX IF NOT EXISTS idx_casting_profiles_person ON public.casting_profiles(person_id);
CREATE INDEX IF NOT EXISTS idx_casting_profiles_location ON public.casting_profiles(location);
CREATE INDEX IF NOT EXISTS idx_casting_profiles_playing_age ON public.casting_profiles(playing_age_min, playing_age_max);

-- Enable RLS
ALTER TABLE public.casting_profiles ENABLE ROW LEVEL SECURITY;

-- Public can read casting profiles if marked visible
DROP POLICY IF EXISTS "Public can view visible casting profiles" ON public.casting_profiles;
CREATE POLICY "Public can view visible casting profiles"
  ON public.casting_profiles FOR SELECT
  USING (show_on_creator_link = true OR show_on_person_page = true);

-- Authenticated claimed owners and admins can manage their own profile
DROP POLICY IF EXISTS "Users can manage their claimed casting profile" ON public.casting_profiles;
CREATE POLICY "Users can manage their claimed casting profile"
  ON public.casting_profiles FOR ALL TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.people WHERE id = casting_profiles.person_id AND claimed_by = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.actor_profile_access WHERE person_id = casting_profiles.person_id AND user_id = auth.uid() AND status = 'active') OR
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'admin_limited')
  )
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.people WHERE id = casting_profiles.person_id AND claimed_by = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.actor_profile_access WHERE person_id = casting_profiles.person_id AND user_id = auth.uid() AND status = 'active') OR
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'admin_limited')
  );

GRANT ALL ON TABLE public.casting_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.casting_profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.casting_profiles TO authenticated;

COMMENT ON TABLE public.casting_profiles IS
  'Casting physical attributes, playing age, languages, skills, and availability for actors and creative talents.';
