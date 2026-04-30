-- ============================================
-- Country Categorization Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add countries column to films for denormalized access
ALTER TABLE films ADD COLUMN IF NOT EXISTS countries TEXT[] DEFAULT '{}';

-- 2. Create countries table
CREATE TABLE IF NOT EXISTS countries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    continent TEXT DEFAULT 'Africa',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create film_countries join table
CREATE TABLE IF NOT EXISTS film_countries (
    film_id UUID REFERENCES films(id) ON DELETE CASCADE,
    country_id UUID REFERENCES countries(id) ON DELETE CASCADE,
    PRIMARY KEY (film_id, country_id)
);

-- 4. Insert African countries
INSERT INTO countries (name, slug, continent) VALUES
('Algeria', 'algeria', 'Africa'),
('Angola', 'angola', 'Africa'),
('Benin', 'benin', 'Africa'),
('Botswana', 'botswana', 'Africa'),
('Burkina Faso', 'burkina-faso', 'Africa'),
('Burundi', 'burundi', 'Africa'),
('Cabo Verde', 'cabo-verde', 'Africa'),
('Cameroon', 'cameroon', 'Africa'),
('Central African Republic', 'central-african-republic', 'Africa'),
('Chad', 'chad', 'Africa'),
('Comoros', 'comoros', 'Africa'),
('Congo', 'congo', 'Africa'),
('Congo (DRC)', 'congo-drc', 'Africa'),
('Djibouti', 'djibouti', 'Africa'),
('Egypt', 'egypt', 'Africa'),
('Equatorial Guinea', 'equatorial-guinea', 'Africa'),
('Eritrea', 'eritrea', 'Africa'),
('Eswatini', 'eswatini', 'Africa'),
('Ethiopia', 'ethiopia', 'Africa'),
('Gabon', 'gabon', 'Africa'),
('Gambia', 'gambia', 'Africa'),
('Ghana', 'ghana', 'Africa'),
('Guinea', 'guinea', 'Africa'),
('Guinea-Bissau', 'guinea-bissau', 'Africa'),
('Ivory Coast', 'ivory-coast', 'Africa'),
('Kenya', 'kenya', 'Africa'),
('Lesotho', 'lesotho', 'Africa'),
('Liberia', 'liberia', 'Africa'),
('Libya', 'libya', 'Africa'),
('Madagascar', 'madagascar', 'Africa'),
('Malawi', 'malawi', 'Africa'),
('Mali', 'mali', 'Africa'),
('Mauritania', 'mauritania', 'Africa'),
('Mauritius', 'mauritius', 'Africa'),
('Morocco', 'morocco', 'Africa'),
('Mozambique', 'mozambique', 'Africa'),
('Namibia', 'namibia', 'Africa'),
('Niger', 'niger', 'Africa'),
('Nigeria', 'nigeria', 'Africa'),
('Rwanda', 'rwanda', 'Africa'),
('Sao Tome and Principe', 'sao-tome-and-principe', 'Africa'),
('Senegal', 'senegal', 'Africa'),
('Seychelles', 'seychelles', 'Africa'),
('Sierra Leone', 'sierra-leone', 'Africa'),
('Somalia', 'somalia', 'Africa'),
('South Africa', 'south-africa', 'Africa'),
('South Sudan', 'south-sudan', 'Africa'),
('Sudan', 'sudan', 'Africa'),
('Tanzania', 'tanzania', 'Africa'),
('Togo', 'togo', 'Africa'),
('Tunisia', 'tunisia', 'Africa'),
('Uganda', 'uganda', 'Africa'),
('Zambia', 'zambia', 'Africa'),
('Zimbabwe', 'zimbabwe', 'Africa')
ON CONFLICT (name) DO NOTHING;

-- 5. Create index for performance
CREATE INDEX IF NOT EXISTS idx_films_countries ON films USING GIN (countries);
