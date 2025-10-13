-- Phase 2: Activities Table Migration
-- Purpose: Persist activity events across page reloads with proper indexing and security

-- Create activities table
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  agent_id text NOT NULL,

  -- Core activity fields
  type text NOT NULL CHECK (type IN (
    'thinking_preview', 'thinking', 'status',
    'tool_start', 'tool_params', 'tool_executing', 'tool_result',
    'batch_start', 'batch_progress', 'batch_complete'
  )),
  tool text,
  tool_id text,

  -- Batch tracking (Phase 2)
  batch_id text,
  batch_total integer,
  batch_completed integer DEFAULT 0,

  -- Content fields (redacted before insert)
  params jsonb,
  result jsonb,
  content text,
  message text,
  error text,

  -- Status and timing
  success boolean,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer GENERATED ALWAYS AS (
    CASE
      WHEN completed_at IS NOT NULL AND started_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000
      ELSE NULL
    END
  ) STORED,

  -- Metadata
  is_redacted boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_batch CHECK (
    batch_id IS NULL OR (
      batch_total IS NOT NULL AND
      batch_total > 0 AND
      batch_completed >= 0 AND
      batch_completed <= batch_total
    )
  ),
  CONSTRAINT valid_tool_execution CHECK (
    (type NOT LIKE 'tool_%') OR (tool IS NOT NULL)
  )
);

-- Indexes for performance
CREATE INDEX idx_activities_user_session ON activities(user_id, session_id);
CREATE INDEX idx_activities_user_created ON activities(user_id, created_at DESC);
CREATE INDEX idx_activities_agent_session ON activities(agent_id, session_id);
CREATE INDEX idx_activities_batch ON activities(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX idx_activities_type ON activities(type) WHERE type IN ('tool_result', 'batch_complete');

-- Row Level Security (RLS)
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Users can only access their own activities
CREATE POLICY "Users can view own activities" ON activities
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activities" ON activities
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own activities" ON activities
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own activities" ON activities
  FOR DELETE USING (auth.uid() = user_id);

-- Data retention: Clean up activities older than 30 days
-- Note: This should be implemented as a scheduled job in production
-- DELETE FROM activities WHERE created_at < now() - interval '30 days';

-- Grants for the authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON activities TO authenticated;
