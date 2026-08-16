-- Professional intent is onboarding/profile metadata, not catalogue permission.
-- Verified catalogue access remains scoped through actor_profile_access.
alter table public.users
  add column if not exists account_intent text not null default 'fan',
  add column if not exists professional_roles text[] not null default '{}',
  add column if not exists professional_onboarding_status text not null default 'not_started';

alter table public.users
  drop constraint if exists users_account_intent_check;
alter table public.users
  add constraint users_account_intent_check
  check (account_intent in ('fan', 'professional'));

alter table public.users
  drop constraint if exists users_professional_onboarding_status_check;
alter table public.users
  add constraint users_professional_onboarding_status_check
  check (professional_onboarding_status in (
    'not_started', 'discovering_profile', 'claim_pending', 'verified'
  ));

update public.users
set account_intent = 'professional'
where role = 'professional';

update public.users u
set professional_roles = array['actor']::text[],
    professional_onboarding_status = case
      when exists (
        select 1 from public.actor_profile_access a
        where a.user_id = u.id and a.status = 'active'
      ) then 'verified'
      when exists (
        select 1 from public.profile_claims c
        where c.user_id = u.id and c.status = 'pending'
      ) then 'claim_pending'
      else 'discovering_profile'
    end
where u.role = 'professional'
  and cardinality(u.professional_roles) = 0;

create or replace function public.sync_professional_status_from_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
  set account_intent = 'professional',
      professional_roles = case
        when 'actor' = any(professional_roles) then professional_roles
        else array_append(professional_roles, 'actor')
      end,
      professional_onboarding_status = case
        when new.status = 'approved' then 'verified'
        when new.status = 'pending' then 'claim_pending'
        else professional_onboarding_status
      end,
      role = case when role = 'fan' then 'professional'::public.user_role else role end,
      updated_at = now()
  where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists sync_professional_status_from_claim on public.profile_claims;
create trigger sync_professional_status_from_claim
  after insert or update of status on public.profile_claims
  for each row execute function public.sync_professional_status_from_claim();

create or replace function public.set_professional_preferences(p_roles text[])
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users;
  v_roles text[];
  v_allowed constant text[] := array[
    'actor', 'director', 'producer', 'writer', 'cinematographer',
    'editor', 'composer', 'costume_designer', 'production_designer', 'other'
  ];
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select coalesce(array_agg(distinct lower(trim(role))), '{}')
  into v_roles
  from unnest(coalesce(p_roles, '{}')) as role
  where nullif(trim(role), '') is not null;

  if cardinality(v_roles) = 0 then
    raise exception 'Select at least one professional role';
  end if;
  if exists (select 1 from unnest(v_roles) role where not (role = any(v_allowed))) then
    raise exception 'Unsupported professional role';
  end if;

  update public.users
  set account_intent = 'professional',
      professional_roles = v_roles,
      professional_onboarding_status = case
        when professional_onboarding_status = 'verified' then 'verified'
        when professional_onboarding_status = 'claim_pending' then 'claim_pending'
        else 'discovering_profile'
      end,
      role = case when role = 'fan' then 'professional'::public.user_role else role end,
      updated_at = now()
  where id = auth.uid()
  returning * into v_user;

  if v_user.id is null then raise exception 'User profile not found'; end if;
  return v_user;
end;
$$;

revoke all on function public.set_professional_preferences(text[]) from public, anon;
grant execute on function public.set_professional_preferences(text[]) to authenticated;
revoke all on function public.sync_professional_status_from_claim() from public, anon, authenticated;
