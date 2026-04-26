-- Add missing values to film_status enum
-- We use DO block to ensure we don't fail if they already exist (though ALTER TYPE ADD VALUE has its own checks, this is safer in some environments)

ALTER TYPE film_status ADD VALUE IF NOT EXISTS 'announced';
ALTER TYPE film_status ADD VALUE IF NOT EXISTS 'filming';
ALTER TYPE film_status ADD VALUE IF NOT EXISTS 'post-production';
ALTER TYPE film_status ADD VALUE IF NOT EXISTS 'released';
ALTER TYPE film_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE film_status ADD VALUE IF NOT EXISTS 'cancelled';
