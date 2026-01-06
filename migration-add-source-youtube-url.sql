-- Migration: Add missing columns to songs table for cover functionality
-- Run this in Supabase SQL Editor

-- Add type column for distinguishing original vs cover songs
ALTER TABLE public.songs 
ADD COLUMN IF NOT EXISTS type text DEFAULT 'original' CHECK (type IN ('original', 'cover'));

-- Add source_youtube_url column for cover songs
ALTER TABLE public.songs 
ADD COLUMN IF NOT EXISTS source_youtube_url text;

-- Optional: Add comments for documentation
COMMENT ON COLUMN public.songs.type IS 'Type of song: original or cover';
COMMENT ON COLUMN public.songs.source_youtube_url IS 'Original YouTube URL used as source for cover songs';
