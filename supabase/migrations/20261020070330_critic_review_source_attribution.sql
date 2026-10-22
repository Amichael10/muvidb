alter table public.critic_reviews
  add column if not exists publication text,
  add column if not exists social_handle text,
  add column if not exists review_type text not null default 'article',
  add column if not exists excerpt_context text;

alter table public.critic_reviews
  drop constraint if exists critic_reviews_review_type_check;

alter table public.critic_reviews
  add constraint critic_reviews_review_type_check
  check (review_type in ('article', 'video', 'social_post'));

comment on column public.critic_reviews.quote is
  'Exact, contiguous pull quote from the original critic review; never an AI paraphrase.';
comment on column public.critic_reviews.rating is
  'Explicit source rating normalized to a five-point scale; null when the source gives no numeric rating.';
comment on column public.critic_reviews.excerpt_context is
  'Neutral context retained when selecting a discussion-worthy pull quote.';
