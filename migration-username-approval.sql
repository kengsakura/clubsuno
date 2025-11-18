-- Migration: Add username and approval system
-- Date: 2025-01-18

-- Add username and approved columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text UNIQUE,
  ADD COLUMN IF NOT EXISTS approved boolean DEFAULT false;

-- Create index for faster username lookups
CREATE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles(username);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.username IS 'Username for login (unique)';
COMMENT ON COLUMN public.profiles.approved IS 'Whether user is approved by admin';

-- Update existing users to be approved
UPDATE public.profiles SET approved = true WHERE approved = false;
