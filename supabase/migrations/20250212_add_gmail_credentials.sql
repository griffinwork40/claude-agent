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

alter table public.gmail_credentials
  enable row level security;

create policy if not exists "Users can read their own Gmail credentials"
  on public.gmail_credentials
  for select
  using (auth.uid() = user_id);

create policy if not exists "Users can manage their own Gmail credentials"
  on public.gmail_credentials
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

