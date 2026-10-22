-- Complete the retirement of the pre-editorial social template registry.
-- The approved simple-editorial template family is intentionally preserved.

update public.social_content_items
set template_id = null
where template_id in (
  select id
  from public.social_templates
  where slug in ('birthday-spotlight-v1', 'upcoming-movie-v1')
);

delete from public.social_templates
where slug in ('birthday-spotlight-v1', 'upcoming-movie-v1');
