-- Run this in Supabase SQL Editor to create the cover-audio storage bucket

-- Create the storage bucket for cover audio files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'cover-audio', 
    'cover-audio', 
    true,  -- Public bucket so URLs are accessible
    52428800,  -- 50MB limit
    ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/m4a', 'audio/mp4', 'audio/x-m4a']
)
ON CONFLICT (id) DO NOTHING;

-- Create policy to allow authenticated users to upload
CREATE POLICY "Allow authenticated uploads to cover-audio"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'cover-audio');

-- Create policy to allow public read access
CREATE POLICY "Allow public read access to cover-audio"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'cover-audio');

-- Create policy to allow users to delete their own files
CREATE POLICY "Allow users to delete own cover-audio files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'cover-audio' AND auth.uid()::text = (storage.foldername(name))[1]);
