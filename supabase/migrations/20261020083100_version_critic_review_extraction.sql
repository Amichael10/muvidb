alter table public.critic_reviews
  add column if not exists extraction_version integer not null default 0;

comment on column public.critic_reviews.extraction_version is
  'Version of the full-review quote/rating extractor. Zero marks legacy RSS-derived rows for in-place re-enrichment.';
