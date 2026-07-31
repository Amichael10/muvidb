-- Structured credit-roll review data.
--
-- "actor" is the application credit role. "cast" was an extraction-section
-- label and caused unnecessary translation in the approval UI.
alter table public.credit_candidates
  drop constraint if exists credit_candidates_credit_type_check;

update public.credit_candidates
set credit_type = 'actor'
where credit_type = 'cast';

alter table public.credit_candidates
  alter column credit_type set default 'actor';

alter table public.credit_candidates
  add constraint credit_candidates_credit_type_check
  check (credit_type in ('actor', 'crew'));

-- Evidence retained for human review and parser QA.
alter table public.credit_candidates
  add column if not exists ocr_confidence real,
  add column if not exists frame_support smallint not null default 1,
  add column if not exists source_video_sec real,
  add column if not exists source_frame_index integer,
  add column if not exists source_ocr_text text,
  add column if not exists source_layout jsonb;

comment on column public.credit_candidates.role_or_character is
  'Character name when credit_type=actor; production role when credit_type=crew.';
comment on column public.credit_candidates.source_frame_sec is
  'Seconds from the beginning of the downloaded tail.';
comment on column public.credit_candidates.source_video_sec is
  'Absolute seconds from the beginning of the source video.';
comment on column public.credit_candidates.source_layout is
  'OCR layout evidence, including parser mode and the detected person box.';

