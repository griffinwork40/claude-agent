-- supabase/migrations/20250212_add_gmail_credentials.sql
-- Purpose: Create gmail_credentials table for storing OAuth tokens per user.

create table if not exists public.gmail_credentials (
  user_id uuid primary key references auth.users (id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expiry timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists gmail_credentials_expiry_idx
  on public.gmail_credentials (expiry);

