-- Migration: Add support for second audio version
-- Date: 2025-01-18

-- Add audio_url_2 and audio_path_2 columns to songs table
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS audio_url_2 text,
  ADD COLUMN IF NOT EXISTS audio_path_2 text;

-- Add comment for documentation
COMMENT ON COLUMN public.songs.audio_url_2 IS 'URL for second version of generated song';
COMMENT ON COLUMN public.songs.audio_path_2 IS 'Path for second version of generated song';
