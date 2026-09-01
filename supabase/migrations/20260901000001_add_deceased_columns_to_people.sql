-- Migration: Add deceased actor tracking columns to people table

ALTER TABLE public.people
ADD COLUMN IF NOT EXISTS date_of_death DATE,
ADD COLUMN IF NOT EXISTS is_deceased BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS death_year INT,
ADD COLUMN IF NOT EXISTS death_month INT;

-- Create function and trigger to auto-populate is_deceased, death_year, death_month when date_of_death is set
CREATE OR REPLACE FUNCTION public.handle_person_deceased_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.date_of_death IS NOT NULL THEN
    NEW.is_deceased := TRUE;
    NEW.death_year := EXTRACT(YEAR FROM NEW.date_of_death)::INT;
    NEW.death_month := EXTRACT(MONTH FROM NEW.date_of_death)::INT;
  ELSIF NEW.is_deceased IS TRUE AND NEW.death_year IS NOT NULL THEN
    -- If year is provided without full date
    IF NEW.death_month IS NOT NULL THEN
      -- try construct first of month if date_of_death is null
      BEGIN
        NEW.date_of_death := make_date(NEW.death_year, NEW.death_month, 1);
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  ELSIF NEW.date_of_death IS NULL AND (NEW.is_deceased IS NULL OR NEW.is_deceased IS FALSE) THEN
    NEW.is_deceased := FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_person_deceased_sync ON public.people;
CREATE TRIGGER trg_person_deceased_sync
BEFORE INSERT OR UPDATE ON public.people
FOR EACH ROW
EXECUTE FUNCTION public.handle_person_deceased_sync();
