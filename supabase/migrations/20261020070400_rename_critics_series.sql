update public.social_content_series
set
  name = 'The Critic''s Take',
  description = 'A verbatim, clearly attributed critical observation that directs audiences to the original review.',
  updated_at = now()
where slug = 'critics_say';

update public.social_templates
set name = 'The Critic''s Take — Simple', updated_at = now()
where slug = 'critics-say-simple-v1';
