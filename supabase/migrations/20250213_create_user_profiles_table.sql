-- User Profiles Table Migration
-- Purpose: Store user profile data extracted from resumes and onboarding process

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Personal information
  personal_info jsonb NOT NULL DEFAULT '{}',
  
  -- Professional experience and skills
  experience jsonb NOT NULL DEFAULT '{}',
  
  -- Job preferences
  preferences jsonb NOT NULL DEFAULT '{}',
  
  -- Resume file information
  resume_path text,
  resume_filename text,
  resume_uploaded_at timestamptz,
  
  -- Profile metadata
  onboarding_completed boolean DEFAULT false,
  profile_completeness_score integer DEFAULT 0 CHECK (profile_completeness_score >= 0 AND profile_completeness_score <= 100),
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT unique_user_profile UNIQUE (user_id)
);

-- Create indexes for performance
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_onboarding ON user_profiles(onboarding_completed) WHERE onboarding_completed = false;
CREATE INDEX idx_user_profiles_updated ON user_profiles(updated_at DESC);

-- Row Level Security (RLS)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can only access their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile" ON user_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- Grants for the authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON user_profiles TO authenticated;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profiles_updated_at();
