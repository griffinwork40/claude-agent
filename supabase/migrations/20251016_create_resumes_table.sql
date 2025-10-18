-- Migration: Create resumes table for multiple resume support
-- Date: 2025-10-16
-- Purpose: Allow users to store and manage multiple resumes in dashboard

-- Create resumes table
CREATE TABLE IF NOT EXISTS public.resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  resume_text TEXT,
  file_size INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON public.resumes(user_id);

-- Create index for sorting by created date
CREATE INDEX IF NOT EXISTS idx_resumes_created_at ON public.resumes(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own resumes
CREATE POLICY "Users can view own resumes"
  ON public.resumes
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own resumes
CREATE POLICY "Users can insert own resumes"
  ON public.resumes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own resumes
CREATE POLICY "Users can update own resumes"
  ON public.resumes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own resumes
CREATE POLICY "Users can delete own resumes"
  ON public.resumes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at on row update
CREATE TRIGGER update_resumes_updated_at
  BEFORE UPDATE ON public.resumes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing resume data from user_profiles to resumes table
-- This will copy any existing resume from user_profiles into the new resumes table
INSERT INTO public.resumes (user_id, file_name, file_path, resume_text, created_at, updated_at)
SELECT 
  user_id,
  COALESCE(
    -- Extract filename from the path (everything after last /)
    SUBSTRING(resume_path FROM '[^/]+$'),
    'resume.pdf'  -- Default fallback
  ) as file_name,
  resume_path,
  resume_text,
  COALESCE(updated_at, NOW()) as created_at,
  COALESCE(updated_at, NOW()) as updated_at
FROM public.user_profiles
WHERE resume_path IS NOT NULL 
  AND resume_path != ''
  AND NOT EXISTS (
    -- Avoid duplicates if migration is run multiple times
    SELECT 1 FROM public.resumes r 
    WHERE r.user_id = user_profiles.user_id 
    AND r.file_path = user_profiles.resume_path
  );

-- Add comment to table
COMMENT ON TABLE public.resumes IS 'Stores multiple resume files per user with metadata and parsed text content';

-- Add comments to columns
COMMENT ON COLUMN public.resumes.file_name IS 'Original filename of the uploaded resume';
COMMENT ON COLUMN public.resumes.file_path IS 'Storage path in Supabase Storage (e.g., resumes/{userId}/{timestamp}_{filename})';
COMMENT ON COLUMN public.resumes.resume_text IS 'Parsed text content from PDF/DOCX for search and preview';
COMMENT ON COLUMN public.resumes.file_size IS 'File size in bytes';
