-- Register the Birthday Spotlight card.
--
-- Same renderer and formats as the actor card — it is the same layout with a
-- different eyebrow, a roles line and a fixed celebratory support line (see
-- docs/social-templates/birthday-spotlight-1x1.png). No schema change is
-- needed; content_type is text and SOURCE_ENTITY_TYPES maps it to 'person'.

insert into public.social_templates (slug, name, content_type, version, is_active, template_config)
values (
  'birthday-spotlight-v1',
  'Birthday Spotlight',
  'birthday_spotlight',
  1,
  true,
  '{"formats":["portrait_4_5","square_1_1","vertical_9_16"],"brand":"muvidb"}'::jsonb
)
on conflict (slug) do update
set
  name = excluded.name,
  content_type = excluded.content_type,
  is_active = excluded.is_active,
  template_config = excluded.template_config;
