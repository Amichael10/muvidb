-- Circuits titles use the same release_type convention as the other
-- first-party streaming syncs.

alter table public.films
  drop constraint if exists films_release_type_check;

alter table public.films
  add constraint films_release_type_check check (
    release_type in (
      'cinema',
      'youtube',
      'netflix',
      'prime_video',
      'kava',
      'showmax',
      'unreleased',
      'apple_tv',
      'disney_plus',
      'hulu',
      'irokotv',
      'youtube_premium',
      'docuth',
      'ebonylife',
      'circuits'
    )
  );
