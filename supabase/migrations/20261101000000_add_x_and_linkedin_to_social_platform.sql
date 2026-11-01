-- Add 'x' and 'linkedin' to social_platform enum
ALTER TYPE public.social_platform ADD VALUE IF NOT EXISTS 'x';
ALTER TYPE public.social_platform ADD VALUE IF NOT EXISTS 'linkedin';
