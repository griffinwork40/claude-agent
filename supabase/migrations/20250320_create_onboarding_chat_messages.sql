-- Migration: Create onboarding_chat_messages table for persistent chat history
-- Purpose: Persist onboarding chat conversations across server instances

CREATE TABLE IF NOT EXISTS public.onboarding_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_chat_messages_user_session
  ON public.onboarding_chat_messages(user_id, session_id, created_at);

ALTER TABLE public.onboarding_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own onboarding messages" ON public.onboarding_chat_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding messages" ON public.onboarding_chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own onboarding messages" ON public.onboarding_chat_messages
  FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.onboarding_chat_messages TO authenticated;
