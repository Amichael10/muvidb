-- Run this once in the Supabase SQL editor
-- Creates the channel_flags table for user-submitted channel reports

create table if not exists channel_flags (
  id           uuid        default gen_random_uuid() primary key,
  channel_id   uuid        references channels(id) on delete cascade not null,
  user_id      uuid        references users(id) on delete set null,
  reason       text        not null,
  details      text,
  status       text        default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at   timestamptz default now()
);

-- Index for fast admin queries
create index if not exists channel_flags_channel_id_idx on channel_flags(channel_id);
create index if not exists channel_flags_status_idx on channel_flags(status);

-- RLS: anyone can insert a flag, only admins can read all flags
alter table channel_flags enable row level security;

create policy "Anyone can flag a channel"
  on channel_flags for insert
  with check (true);

create policy "Admins can view all flags"
  on channel_flags for select
  using (
    exists (
      select 1 from users
      where users.id = auth.uid() and users.role = 'admin'
    )
  );

create policy "Admins can update flag status"
  on channel_flags for update
  using (
    exists (
      select 1 from users
      where users.id = auth.uid() and users.role = 'admin'
    )
  );
