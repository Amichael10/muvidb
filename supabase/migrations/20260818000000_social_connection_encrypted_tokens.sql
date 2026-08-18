-- Encrypted provider credentials. Ciphertext is only read through service-role API code;
-- browser clients receive a deliberately sanitized connection object.
alter table public.social_connections
  add column if not exists token_ciphertext text,
  add column if not exists token_iv text,
  add column if not exists token_auth_tag text;

-- The foundation granted table-level SELECT. Remove it before replacing it with
-- an explicit safe column list; column revokes cannot override table grants.
revoke select on public.social_connections from authenticated;

grant select (
  id, platform, display_name, username, external_account_id, external_parent_id,
  profile_image_url, status, granted_scopes, token_secret_id, token_expires_at,
  refresh_token_expires_at, last_verified_at, connection_metadata, created_by,
  created_at, updated_at
) on public.social_connections to authenticated;

-- OAuth state is server-only, short-lived, and consumed atomically by the
-- callback. It is intentionally unavailable to browser roles.
create table if not exists public.social_oauth_states (
  state_hash text primary key,
  provider public.social_platform not null,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  redirect_uri text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists social_oauth_states_expiry_idx
  on public.social_oauth_states(expires_at);

alter table public.social_oauth_states enable row level security;
revoke all on public.social_oauth_states from anon, authenticated;
grant all on public.social_oauth_states to service_role;
