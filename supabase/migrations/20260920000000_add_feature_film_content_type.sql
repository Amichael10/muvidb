-- Add 'feature film', 'feature_film', 'serie', 'mini series' to films_content_type_check
ALTER TABLE films DROP CONSTRAINT IF EXISTS films_content_type_check;

ALTER TABLE films ADD CONSTRAINT films_content_type_check
  CHECK (content_type IN (
    'movie',
    'feature film',
    'feature_film',
    'series',
    'serie',
    'mini series',
    'mini_series',
    'documentary'
  ));
