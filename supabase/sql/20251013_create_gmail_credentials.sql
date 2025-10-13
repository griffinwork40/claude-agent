-- supabase/sql/20251013_create_gmail_credentials.sql
-- Purpose: Create gmail_credentials table for storing OAuth tokens securely per user.

create table if not exists public.gmail_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text,
  scope text,
  token_type text,
  access_token_expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists gmail_credentials_user_id_idx
  on public.gmail_credentials (user_id);

