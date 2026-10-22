update public.social_content_series
set
  name = 'Now Streaming',
  description = 'Newly available films on verified YouTube channels and streaming platforms.',
  updated_at = now()
where slug = 'where_to_watch';

update public.social_templates
set name = 'Now Streaming — Simple', updated_at = now()
where slug = 'where-to-watch-simple-v1';
