-- Full-bleed, image-led MuviDB social templates for every active editorial series.
-- These are intentionally unscheduled; the migration only registers renderer choices.

insert into public.social_templates (name, slug, content_type, version, is_active, template_config)
values
  ('Behind The Camera — Simple', 'behind-camera-simple-v1', 'actor_spotlight', 1, true, '{"renderer":"html","file":"simple-editorial-v1.html","formats":["portrait_4_5"],"source_entity_type":"person","variant":"behind_camera"}'),
  ('Film Conversation — Simple', 'film-conversation-simple-v1', 'film_conversation', 1, true, '{"renderer":"html","file":"simple-editorial-v1.html","formats":["portrait_4_5"],"source_entity_type":"film","variant":"film_conversation"}'),
  ('By The Numbers — Simple', 'by-the-numbers-simple-v1', 'upcoming_movie', 1, true, '{"renderer":"html","file":"simple-editorial-v1.html","formats":["portrait_4_5"],"source_entity_type":"film","variant":"by_the_numbers"}'),
  ('New & Upcoming — Simple', 'new-upcoming-simple-v1', 'upcoming_movie', 1, true, '{"renderer":"html","file":"simple-editorial-v1.html","formats":["portrait_4_5"],"source_entity_type":"film","variant":"new_upcoming"}'),
  ('One Film, Two Takes — Simple', 'one-film-two-takes-simple-v1', 'critics_say', 1, true, '{"renderer":"html","file":"simple-editorial-v1.html","formats":["portrait_4_5"],"source_entity_type":"film","variant":"one_film_two_takes"}'),
  ('Stage To Screen — Simple', 'stage-to-screen-simple-v1', 'whats_on_stage', 1, true, '{"renderer":"html","file":"simple-editorial-v1.html","formats":["portrait_4_5"],"source_entity_type":"play","variant":"stage_to_screen"}'),
  ('The Critic — Simple', 'critic-spotlight-simple-v1', 'critics_say', 1, true, '{"renderer":"html","file":"simple-editorial-v1.html","formats":["portrait_4_5"],"source_entity_type":"film","variant":"critic_spotlight"}'),
  ('The Filmography — Simple', 'filmography-simple-v1', 'actor_spotlight', 1, true, '{"renderer":"html","file":"simple-editorial-v1.html","formats":["portrait_4_5"],"source_entity_type":"person","variant":"filmography"}'),
  ('Weekend Watchlist — Simple', 'weekend-watchlist-simple-v1', 'weekend_watchlist', 1, true, '{"renderer":"html","file":"simple-editorial-v1.html","formats":["portrait_4_5"],"source_entity_type":"film","variant":"weekend_watchlist"}'),
  ('What The Critics Say — Simple', 'critics-say-simple-v1', 'critics_say', 1, true, '{"renderer":"html","file":"simple-editorial-v1.html","formats":["portrait_4_5"],"source_entity_type":"film","variant":"critics_say"}'),
  ('What''s On Stage — Simple', 'on-stage-simple-v1', 'whats_on_stage', 1, true, '{"renderer":"html","file":"simple-editorial-v1.html","formats":["portrait_4_5"],"source_entity_type":"play","variant":"on_stage"}'),
  ('Where To Watch — Simple', 'where-to-watch-simple-v1', 'where_to_watch', 1, true, '{"renderer":"html","file":"simple-editorial-v1.html","formats":["portrait_4_5"],"source_entity_type":"film","variant":"where_to_watch"}'),
  ('You Know The Face — Simple', 'you-know-the-face-simple-v1', 'actor_spotlight', 1, true, '{"renderer":"html","file":"simple-editorial-v1.html","formats":["portrait_4_5"],"source_entity_type":"person","variant":"you_know_the_face"}')
on conflict (slug) do update set
  name = excluded.name,
  content_type = excluded.content_type,
  version = excluded.version,
  is_active = excluded.is_active,
  template_config = excluded.template_config,
  updated_at = now();

with mappings(series_slug, template_slug) as (
  values
    ('behind_the_camera', 'behind-camera-simple-v1'),
    ('film_conversation', 'film-conversation-simple-v1'),
    ('by_the_numbers', 'by-the-numbers-simple-v1'),
    ('new_and_upcoming', 'new-upcoming-simple-v1'),
    ('one_film_two_takes', 'one-film-two-takes-simple-v1'),
    ('stage_to_screen', 'stage-to-screen-simple-v1'),
    ('the_critic', 'critic-spotlight-simple-v1'),
    ('filmography', 'filmography-simple-v1'),
    ('weekend_watchlist', 'weekend-watchlist-simple-v1'),
    ('critics_say', 'critics-say-simple-v1'),
    ('whats_on_stage', 'on-stage-simple-v1'),
    ('where_to_watch', 'where-to-watch-simple-v1'),
    ('you_know_the_face', 'you-know-the-face-simple-v1')
)
update public.social_content_series s
set figma_template_key = m.template_slug,
    config = coalesce(s.config, '{}'::jsonb) || jsonb_build_object('template_slug', m.template_slug),
    updated_at = now()
from mappings m
where s.slug = m.series_slug;
