-- ============================================================
-- INSTANT DATABASE RE-LINKING FOR TOYIN ABRAHAM & IBRAHIM YEKINI
-- Run this directly in Supabase SQL Editor!
-- ============================================================

-- 1. Ensure Ibrahim Yekini profile exists and is clean
INSERT INTO people (id, name, slug, source)
VALUES ('6a615c4a-33e9-4a92-ba86-0b3827319571', 'Ibrahim Yekini (Itele D Icon)', 'ibrahim-yekini-itele', 'manual_recovery')
ON CONFLICT (id) DO UPDATE SET name = 'Ibrahim Yekini (Itele D Icon)';

-- 2. Link all existing DB films matching Ibrahim Yekini / Itele / Koleoso
INSERT INTO credits (film_id, person_id, role)
SELECT f.id, '6a615c4a-33e9-4a92-ba86-0b3827319571', 'actor'
FROM films f
WHERE f.title ILIKE '%Ibrahim%Yekini%'
   OR f.title ILIKE '%Itele%'
   OR f.title ILIKE '%Koleoso%'
   OR f.synopsis ILIKE '%Ibrahim Yekini%'
   OR f.synopsis ILIKE '%Itele%'
ON CONFLICT (film_id, person_id, role) DO NOTHING;

-- 3. Find Toyin Abraham profile ID
DO $$
DECLARE
  v_toyin_id uuid;
BEGIN
  SELECT id INTO v_toyin_id FROM people WHERE name ILIKE '%Toyin%Abraham%' OR name ILIKE '%Toyin%Aimakhu%' LIMIT 1;
  IF v_toyin_id IS NULL THEN
    INSERT INTO people (name, slug, source) VALUES ('Toyin Abraham', 'toyin-abraham', 'manual_recovery')
    RETURNING id INTO v_toyin_id;
  END IF;

  -- Link all existing DB films matching Toyin Abraham / Toyin Aimakhu
  INSERT INTO credits (film_id, person_id, role)
  SELECT f.id, v_toyin_id, 'actor'
  FROM films f
  WHERE f.title ILIKE '%Toyin%Abraham%'
     OR f.title ILIKE '%Toyin%Aimakhu%'
     OR f.synopsis ILIKE '%Toyin Abraham%'
     OR f.synopsis ILIKE '%Toyin Aimakhu%'
  ON CONFLICT (film_id, person_id, role) DO NOTHING;
END $$;

-- 4. Update cached film_count for both profiles
UPDATE people
SET film_count = (SELECT COUNT(*) FROM credits WHERE credits.person_id = people.id)
WHERE name ILIKE '%Ibrahim%Yekini%' OR name ILIKE '%Toyin%Abraham%';
