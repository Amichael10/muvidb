-- Track Telegram delivery for actor profile claims so alerts are idempotent
-- and failed sends can be retried from the admin claim queue.

alter table public.profile_claims
  add column if not exists telegram_notified_at timestamptz,
  add column if not exists telegram_notification_error text;

create index if not exists profile_claims_unnotified_pending_idx
  on public.profile_claims(created_at asc)
  where status = 'pending' and telegram_notified_at is null;
