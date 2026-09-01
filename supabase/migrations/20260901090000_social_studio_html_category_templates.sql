-- Register the supplied Social Studio HTML designs and map the most-used
-- editorial categories to them. The HTML files are vendored in the API bundle;
-- this migration stores their slugs/config only.

insert into public.social_templates (slug, name, content_type, version, is_active, template_config)
values
  (
    'on-stage-theatre-v1',
    'On Stage Theatre',
    'whats_on_stage',
    1,
    true,
    '{"renderer":"html","file":"on-stage-theatre-v1.html","formats":["square_1_1"],"source_entity_type":"play"}'
  ),
  (
    'critics-say-v1',
    'What The Critics Say',
    'critics_say',
    1,
    true,
    '{"renderer":"html","file":"critics-say-v1.html","formats":["square_1_1","vertical_9_16"],"source_entity_type":"film","slides":3}'
  ),
  (
    'watchlist-this-week-v1',
    'Watchlist This Week',
    'weekend_watchlist',
    1,
    true,
    '{"renderer":"html","file":"watchlist-this-week-v1.html","formats":["square_1_1"],"source_entity_type":"film","supports_carousel":true}'
  ),
  (
    'nollywood-debate-v1',
    'Nollywood Debate',
    'film_conversation',
    1,
    true,
    '{"renderer":"html","file":"nollywood-debate-v1.html","formats":["square_1_1"],"source_entity_type":"film"}'
  ),
  (
    'now-showing-cinemas-v1',
    'Now Showing in Cinemas',
    'weekend_watchlist',
    1,
    true,
    '{"renderer":"html","file":"now-showing-cinemas-v1.html","formats":["square_1_1"],"source_entity_type":"film"}'
  )
on conflict (slug) do update set
  name = excluded.name,
  content_type = excluded.content_type,
  version = excluded.version,
  is_active = excluded.is_active,
  template_config = excluded.template_config;

update public.social_content_series
set figma_template_key = case slug
  when 'critics_say' then 'critics-say-v1'
  when 'one_film_two_takes' then 'critics-say-v1'
  when 'weekend_watchlist' then 'watchlist-this-week-v1'
  when 'whats_on_stage' then 'on-stage-theatre-v1'
  when 'film_conversation' then 'nollywood-debate-v1'
  else figma_template_key
end,
config = case slug
  when 'critics_say' then config || '{"template_slug":"critics-say-v1"}'::jsonb
  when 'one_film_two_takes' then config || '{"template_slug":"critics-say-v1"}'::jsonb
  when 'weekend_watchlist' then config || '{"template_slug":"watchlist-this-week-v1","alternate_template_slug":"now-showing-cinemas-v1"}'::jsonb
  when 'whats_on_stage' then config || '{"template_slug":"on-stage-theatre-v1"}'::jsonb
  when 'film_conversation' then config || '{"template_slug":"nollywood-debate-v1"}'::jsonb
  else config
end
where slug in ('critics_say','one_film_two_takes','weekend_watchlist','whats_on_stage','film_conversation');
