-- Content Deduplication: prevent regenerating identical videos
-- Uses built-in md5() instead of pgcrypto (pgcrypto digest() is not accessible in Supabase)

-- Add content_hash column to videos table
ALTER TABLE videos ADD COLUMN IF NOT EXISTS content_hash text;

-- Partial index for fast duplicate lookups (only rows with a hash)
CREATE INDEX IF NOT EXISTS idx_videos_content_hash ON videos(content_hash)
  WHERE content_hash IS NOT NULL AND status IN ('ready', 'posted', 'scheduled');

-- SQL function to generate content hash from generation parameters
CREATE OR REPLACE FUNCTION generate_content_hash(
  p_niche text,
  p_language text,
  p_visual_style text,
  p_voice text,
  p_music_style text
)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT md5(
    lower(trim(p_niche)) || '|' ||
    lower(trim(p_language)) || '|' ||
    lower(trim(p_visual_style)) || '|' ||
    lower(trim(p_voice)) || '|' ||
    lower(trim(p_music_style))
  );
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION generate_content_hash(text, text, text, text, text) TO authenticated;
