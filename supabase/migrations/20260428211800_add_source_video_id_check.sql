
-- Add check constraint to prevent empty strings in source_video_id
-- This ensures that source_video_id is either NULL or a non-empty string,
-- which prevents unique constraint violations with empty strings when multiple records are "unlinked".

ALTER TABLE films ADD CONSTRAINT films_source_video_id_check CHECK (source_video_id <> '');
