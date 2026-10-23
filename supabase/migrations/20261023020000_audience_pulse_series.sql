-- Audience Pulse: real mined viewer comments over the film artwork, with
-- MuviDB's own "% liked". Scheduled Friday evening and Saturday morning.
--
-- Deliberately not an IMDb score: most of the catalogue is YouTube Nollywood
-- that was never on IMDb, so that badge would be inventing a number.

insert into public.social_content_series
  (slug, name, description, category, cooldown_days, preferred_format, figma_template_key, requires_poster, requires_reviews, min_reviews, config)
values
  (
    'audience_pulse',
    'Audience Pulse',
    'Real viewer comments and MuviDB''s % liked, over the film artwork',
    'discovery',
    30,
    'single_image',
    'audience-pulse',
    true,
    true,
    3,
    '{"template_slug":"audience-pulse-v1","min_liked_percent":60,"min_quotable_comments":3}'::jsonb
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  cooldown_days = excluded.cooldown_days,
  preferred_format = excluded.preferred_format,
  figma_template_key = excluded.figma_template_key,
  requires_poster = excluded.requires_poster,
  requires_reviews = excluded.requires_reviews,
  min_reviews = excluded.min_reviews,
  config = excluded.config,
  active = true,
  updated_at = now();

-- Its own HTML file rather than a simple-editorial variant: the layout is
-- comment cards scattered over the artwork and shares nothing with that one.
insert into public.social_templates (name, slug, content_type, version, is_active, template_config)
values
  (
    'Audience Pulse',
    'audience-pulse-v1',
    'audience_pulse',
    1,
    true,
    '{"renderer":"html","file":"audience-verdict-v1.html","formats":["portrait_4_5"],"source_entity_type":"film","variant":"audience_pulse"}'::jsonb
  )
on conflict (slug) do update set
  name = excluded.name,
  content_type = excluded.content_type,
  is_active = true,
  template_config = excluded.template_config,
  updated_at = now();
