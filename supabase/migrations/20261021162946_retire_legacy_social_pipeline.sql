-- Retire the previous Social Studio delivery queue without erasing published history.

update public.social_publish_jobs
set
  status = 'cancelled',
  locked_at = null,
  locked_by = null,
  last_error_code = 'legacy_pipeline_retired',
  last_error_message = 'Cancelled when the previous social publishing workflow was retired.',
  completed_at = coalesce(completed_at, now()),
  updated_at = now()
where status in ('queued', 'processing', 'retrying');

update public.social_platform_variants
set
  status = 'draft',
  scheduled_for = null,
  updated_at = now()
where status = 'scheduled';

update public.social_content_items
set
  status = 'draft',
  updated_at = now()
where status = 'scheduled';

with legacy_templates as (
  select id
  from public.social_templates
  where slug in (
    'actor-spotlight-v1',
    'critics-say-v1',
    'nollywood-debate-v1',
    'now-showing-cinemas-v1',
    'on-stage-theatre-v1',
    'watchlist-this-week-v1'
  )
)
update public.social_content_items
set template_id = null, updated_at = now()
where template_id in (select id from legacy_templates);

delete from public.social_templates
where slug in (
  'actor-spotlight-v1',
  'critics-say-v1',
  'nollywood-debate-v1',
  'now-showing-cinemas-v1',
  'on-stage-theatre-v1',
  'watchlist-this-week-v1'
);
