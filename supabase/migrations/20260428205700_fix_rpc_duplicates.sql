-- Update the RPC to correctly handle source_video_id and prevent duplicates better
CREATE OR REPLACE FUNCTION batch_create_films_from_videos(video_db_ids UUID[])
RETURNS TABLE(video_id UUID, new_film_id UUID) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    vid UUID;
    fid UUID;
    v_title TEXT;
    v_desc TEXT;
    v_poster TEXT;
    v_url TEXT;
    v_year INT;
    v_published TIMESTAMP;
    v_channel_id UUID;
    v_adapter TEXT;
    v_youtube_id TEXT;
    target_release_type TEXT;
BEGIN
    FOREACH vid IN ARRAY video_db_ids
    LOOP
        -- Get video details and channel adapter
        SELECT 
            cv.title, cv.description, cv.poster_url, cv.watch_url, cv.published_at, cv.channel_id, c.adapter, cv.video_id
        INTO 
            v_title, v_desc, v_poster, v_url, v_published, v_channel_id, v_adapter, v_youtube_id
        FROM channel_videos cv
        JOIN channels c ON cv.channel_id = c.id
        WHERE cv.id = vid;

        -- Determine release type based on channel adapter
        IF v_adapter = 'kava' THEN
            target_release_type := 'kava';
        ELSE
            target_release_type := 'youtube';
        END IF;

        -- Extract year
        v_year := EXTRACT(YEAR FROM v_published);

        -- Insert into films or update if exists by source_video_id
        -- We prioritize source_video_id over title/year for YouTube imports
        INSERT INTO films (
            title, 
            synopsis, 
            poster_url, 
            year, 
            release_type, 
            youtube_watch_url,
            source_video_id,
            status,
            is_trending,
            is_featured,
            source
        )
        VALUES (
            v_title, 
            v_desc, 
            v_poster, 
            COALESCE(v_year, 2024), 
            target_release_type, 
            v_url,
            NULLIF(v_youtube_id, ''),
            'released',
            false,
            false,
            'youtube'
        )
        ON CONFLICT (source_video_id) DO UPDATE SET
            youtube_watch_url = EXCLUDED.youtube_watch_url,
            release_type = EXCLUDED.release_type,
            title = CASE WHEN films.title IS NULL OR films.title = '' THEN EXCLUDED.title ELSE films.title END
        RETURNING id INTO fid;

        -- Link the video to the film
        UPDATE channel_videos 
        SET film_id = fid, 
            match_status = 'manual' 
        WHERE id = vid;

        video_id := vid;
        new_film_id := fid;
        RETURN NEXT;
    END LOOP;
END;
$$;
