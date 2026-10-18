-- The original filmmaker_portfolios migration defaulted accent_color to
-- '#f59e0b', which is Tailwind's amber rather than the MuviDB brand orange
-- (#FF5A1F). Because it is a column default, every portfolio inherited it
-- without anyone choosing it, so every creator page rendered yellow.
--
-- New portfolios now default to the brand colour. Existing rows still holding
-- the old default are moved across; a row whose colour was actually chosen by
-- its creator is left untouched.

ALTER TABLE public.filmmaker_portfolios
  ALTER COLUMN accent_color SET DEFAULT '#FF5A1F';

UPDATE public.filmmaker_portfolios
   SET accent_color = '#FF5A1F'
 WHERE lower(accent_color) = '#f59e0b';
