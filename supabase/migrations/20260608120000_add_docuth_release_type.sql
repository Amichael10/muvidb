-- Alter the release_type check constraint to include 'docuth'
ALTER TABLE films DROP CONSTRAINT IF EXISTS films_release_type_check;
ALTER TABLE films ADD CONSTRAINT films_release_type_check CHECK (
  release_type IN (
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
    'docuth'
  )
);
