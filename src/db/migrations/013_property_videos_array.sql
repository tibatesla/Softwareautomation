-- 013_property_videos_array.sql
-- Videos follow the same pattern as images now: any number of URLs, from
-- any CDN. Replaces the single video_url column with a videos array,
-- carrying forward any existing value rather than dropping data.

ALTER TABLE properties ADD COLUMN videos text[] NOT NULL DEFAULT '{}';

UPDATE properties
SET videos = ARRAY[video_url]
WHERE video_url IS NOT NULL;

ALTER TABLE properties DROP COLUMN video_url;
