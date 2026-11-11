-- Migration: 20261111160000_allow_stage_play_contributions.sql
-- Description: Expand contributions_type_check to support stage plays (edit_play, new_play, report_play).

ALTER TABLE public.contributions DROP CONSTRAINT IF EXISTS contributions_type_check;

ALTER TABLE public.contributions
  ADD CONSTRAINT contributions_type_check CHECK (type IN (
    'new_person',
    'new_film',
    'new_channel',
    'new_play',
    'edit_person',
    'edit_film',
    'edit_play',
    'report_link',
    'report_channel',
    'report_play'
  ));

COMMENT ON CONSTRAINT contributions_type_check ON public.contributions IS
  'Allowed community contribution types including films, people, channels, and stage plays.';
