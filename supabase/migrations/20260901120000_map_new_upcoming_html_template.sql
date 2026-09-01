-- Use the supplied cinema HTML design for the New & Upcoming editorial lane.
-- Runtime candidate selection also applies this mapping so previews do not
-- depend on migration timing during a deployment.

update public.social_content_series
set figma_template_key = 'now-showing-cinemas-v1',
    config = config || '{"template_slug":"now-showing-cinemas-v1"}'::jsonb
where slug = 'new_and_upcoming';
