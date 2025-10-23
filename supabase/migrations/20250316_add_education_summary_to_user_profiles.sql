-- Migration: Add education and summary columns to user_profiles table
-- Purpose: Store education information and professional summary from resume parsing

-- Add education column to store education history
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS education jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Add summary column for professional summary
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS summary text DEFAULT '';

-- Add comments for documentation
COMMENT ON COLUMN public.user_profiles.education IS 'Education history array from resume parsing';
COMMENT ON COLUMN public.user_profiles.summary IS 'Professional summary from resume parsing';