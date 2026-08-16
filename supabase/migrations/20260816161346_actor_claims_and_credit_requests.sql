-- Actor-only profile claims and moderated filmography changes.
--
-- Claimants can only create/read their own requests. They never receive direct
-- write access to films, credits, film_genres, or people. All catalogue changes
-- are applied by full admins through service-role-only transactional RPCs.

alter table public.profile_claims
  add column if not exists social_platform text,
  add column if not exists social_handle text,
  add column if not exists social_url text,
  add column if not exists verification_code text,
  add column if not exists verification_status text not null default 'awaiting_contact',
  add column if not exists contacted_at timestamptz,
  add column if not exists verified_at timestamptz,
  add column if not exists reviewer_note text,
  add column if not exists rejection_reason text,
  add column if not exists approval_email_sent_at timestamptz;

alter table public.profile_claims
  drop constraint if exists profile_claims_social_platform_check;
alter table public.profile_claims
  add constraint profile_claims_social_platform_check
  check (social_platform is null or social_platform in ('instagram', 'x', 'tiktok', 'facebook', 'youtube'));

alter table public.profile_claims
  drop constraint if exists profile_claims_verification_status_check;
alter table public.profile_claims
  add constraint profile_claims_verification_status_check
  check (verification_status in (
    'awaiting_contact', 'contacted', 'confirmed', 'needs_information',
    'verified', 'rejected', 'expired'
  ));

update public.profile_claims
set verification_code = upper(substr(md5(id::text || clock_timestamp()::text), 1, 6))
where verification_code is null;

alter table public.profile_claims
  alter column verification_code set default upper(substr(md5(gen_random_uuid()::text), 1, 6));
alter table public.profile_claims
  alter column verification_code set not null;

create index if not exists profile_claims_person_status_idx
  on public.profile_claims(person_id, status, created_at desc);
create index if not exists profile_claims_user_status_idx
  on public.profile_claims(user_id, status, created_at desc);

create table if not exists public.actor_profile_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  claim_id uuid references public.profile_claims(id) on delete set null,
  access_role text not null default 'owner' check (access_role in ('owner', 'manager', 'editor')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  granted_by uuid references public.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_by uuid references public.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, person_id)
);

create unique index if not exists actor_profile_access_one_active_owner_idx
  on public.actor_profile_access(person_id)
  where status = 'active' and access_role = 'owner';
create index if not exists actor_profile_access_user_idx
  on public.actor_profile_access(user_id, status);

-- Preserve access for any actor accounts approved by the legacy flow.
insert into public.actor_profile_access (
  user_id, person_id, claim_id, access_role, status, granted_by, granted_at
)
select distinct on (u.linked_profile_id)
  u.id,
  u.linked_profile_id,
  c.id,
  'owner',
  'active',
  c.reviewed_by,
  coalesce(c.reviewed_at, u.updated_at, now())
from public.users u
left join lateral (
  select pc.id, pc.reviewed_by, pc.reviewed_at
  from public.profile_claims pc
  where pc.user_id = u.id and pc.person_id = u.linked_profile_id and pc.status = 'approved'
  order by pc.reviewed_at desc nulls last, pc.created_at desc
  limit 1
) c on true
where u.linked_profile_id is not null
order by u.linked_profile_id, c.reviewed_at desc nulls last
on conflict do nothing;

create or replace function public.prevent_duplicate_actor_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.profile_claims
    where user_id = new.user_id
      and person_id = new.person_id
      and status in ('pending', 'approved')
  ) then
    raise exception 'You already have an active claim for this actor profile';
  end if;
  if exists (
    select 1 from public.people
    where id = new.person_id and claimed_by is not null and claimed_by <> new.user_id
  ) then
    raise exception 'This actor profile is already claimed';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_duplicate_actor_claim on public.profile_claims;
create trigger prevent_duplicate_actor_claim
  before insert on public.profile_claims
  for each row execute function public.prevent_duplicate_actor_claim();

create table if not exists public.actor_credit_requests (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references public.users(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  request_type text not null check (request_type in ('add_existing', 'add_new_film', 'remove')),
  film_id uuid references public.films(id) on delete set null,
  credit_id uuid references public.credits(id) on delete set null,
  role text,
  character_name text,
  proposed_film jsonb,
  note text,
  evidence_url text,
  status text not null default 'submitted' check (status in (
    'submitted', 'in_review', 'needs_information', 'approved', 'rejected', 'withdrawn'
  )),
  reviewer_note text,
  rejection_reason text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  applied_film_id uuid references public.films(id) on delete set null,
  applied_credit_id uuid references public.credits(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint actor_credit_requests_shape_check check (
    (request_type = 'add_existing' and film_id is not null and credit_id is null and nullif(trim(role), '') is not null and proposed_film is null)
    or
    (request_type = 'add_new_film' and film_id is null and credit_id is null and nullif(trim(role), '') is not null and proposed_film is not null)
    or
    (request_type = 'remove' and credit_id is not null and proposed_film is null and nullif(trim(note), '') is not null)
  ),
  constraint actor_credit_requests_evidence_url_check check (
    evidence_url is null or evidence_url ~* '^https://'
  )
);

create index if not exists actor_credit_requests_submitter_idx
  on public.actor_credit_requests(submitted_by, status, created_at desc);
create index if not exists actor_credit_requests_review_idx
  on public.actor_credit_requests(status, created_at asc);
create index if not exists actor_credit_requests_person_idx
  on public.actor_credit_requests(person_id, created_at desc);
create unique index if not exists actor_credit_requests_one_open_removal_idx
  on public.actor_credit_requests(credit_id)
  where request_type = 'remove' and status in ('submitted', 'in_review', 'needs_information');
create unique index if not exists actor_credit_requests_one_open_existing_add_idx
  on public.actor_credit_requests(person_id, film_id, lower(trim(role)))
  where request_type = 'add_existing' and status in ('submitted', 'in_review', 'needs_information');

alter table public.actor_profile_access enable row level security;
alter table public.actor_credit_requests enable row level security;

grant select on public.actor_profile_access to authenticated;
grant select, insert on public.actor_credit_requests to authenticated;
grant all on public.actor_profile_access to service_role;
grant all on public.actor_credit_requests to service_role;

drop policy if exists "actor_access_read_own" on public.actor_profile_access;
create policy "actor_access_read_own" on public.actor_profile_access
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "actor_credit_requests_read_own" on public.actor_credit_requests;
create policy "actor_credit_requests_read_own" on public.actor_credit_requests
  for select to authenticated
  using (submitted_by = auth.uid() or public.is_admin());

drop policy if exists "actor_credit_requests_insert_own" on public.actor_credit_requests;
create policy "actor_credit_requests_insert_own" on public.actor_credit_requests
  for insert to authenticated
  with check (
    submitted_by = auth.uid()
    and status = 'submitted'
    and reviewed_by is null
    and reviewed_at is null
    and (
      request_type <> 'add_new_film'
      or (
        evidence_url is not null
        and nullif(trim(proposed_film->>'title'), '') is not null
        and nullif(trim(proposed_film->>'content_type'), '') is not null
        and nullif(trim(proposed_film->>'year'), '') is not null
        and nullif(trim(proposed_film->>'release_type'), '') is not null
        and jsonb_typeof(proposed_film->'countries') = 'array'
        and jsonb_array_length(proposed_film->'countries') > 0
      )
    )
    and exists (
      select 1 from public.actor_profile_access access
      where access.user_id = auth.uid()
        and access.person_id = actor_credit_requests.person_id
        and access.status = 'active'
    )
    and (
      credit_id is null
      or exists (
        select 1 from public.credits c
        where c.id = actor_credit_requests.credit_id
          and c.person_id = actor_credit_requests.person_id
      )
    )
  );

-- Claimants may only create pending social-verification requests for themselves.
drop policy if exists "Allow user insert own claims" on public.profile_claims;
create policy "Allow user insert own claims" on public.profile_claims
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and status = 'pending'
    and verification_status = 'awaiting_contact'
    and social_platform is not null
    and nullif(trim(social_handle), '') is not null
    and nullif(trim(social_url), '') is not null
    and social_url ~* '^https://'
    and reviewed_by is null
    and reviewed_at is null
    and verified_at is null
  );

-- Remove the old broad professional catalogue insertion permissions. Actor
-- accounts submit requests only; authenticated admins retain their existing
-- catalogue tools and service role continues to bypass RLS.
drop policy if exists "Allow film inserts" on public.films;
drop policy if exists "Allow credit inserts" on public.credits;
drop policy if exists "Allow film_genre inserts" on public.film_genres;
create policy "Allow film inserts" on public.films
  for insert to authenticated with check (public.is_admin());
create policy "Allow credit inserts" on public.credits
  for insert to authenticated with check (public.is_admin());
create policy "Allow film_genre inserts" on public.film_genres
  for insert to authenticated with check (public.is_admin());
revoke execute on function public.create_pro_profile(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.approve_actor_profile_claim(
  p_claim_id uuid,
  p_admin_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.profile_claims%rowtype;
  v_person public.people%rowtype;
  v_user public.users%rowtype;
begin
  if not exists (
    select 1 from public.users where id = p_admin_id and role = 'admin'::user_role
  ) then
    raise exception 'Full admin access required';
  end if;

  select * into v_claim
  from public.profile_claims
  where id = p_claim_id
  for update;

  if v_claim.id is null then raise exception 'Claim not found'; end if;
  if v_claim.status <> 'pending'::claim_status then raise exception 'Claim is no longer pending'; end if;
  if v_claim.verification_status not in ('confirmed', 'verified') then
    raise exception 'Social confirmation must be recorded before approval';
  end if;

  select * into v_person from public.people where id = v_claim.person_id for update;
  if v_person.id is null then raise exception 'Actor profile not found'; end if;
  if v_person.claimed_by is not null and v_person.claimed_by <> v_claim.user_id then
    raise exception 'Actor profile is already claimed';
  end if;

  if exists (
    select 1 from public.actor_profile_access
    where person_id = v_claim.person_id and status = 'active' and user_id <> v_claim.user_id
  ) then
    raise exception 'Actor profile already has an active owner';
  end if;

  insert into public.actor_profile_access (
    user_id, person_id, claim_id, access_role, status, granted_by
  ) values (
    v_claim.user_id, v_claim.person_id, v_claim.id, 'owner', 'active', p_admin_id
  )
  on conflict (user_id, person_id) do update set
    claim_id = excluded.claim_id,
    access_role = 'owner',
    status = 'active',
    granted_by = excluded.granted_by,
    granted_at = now(),
    revoked_by = null,
    revoked_at = null,
    updated_at = now();

  update public.profile_claims set
    status = 'approved',
    verification_status = 'verified',
    verified_at = coalesce(verified_at, now()),
    reviewed_by = p_admin_id,
    reviewed_at = now()
  where id = v_claim.id;

  update public.profile_claims set
    status = 'rejected',
    verification_status = 'rejected',
    rejection_reason = coalesce(rejection_reason, 'Another verified claim for this profile was approved.'),
    reviewed_by = p_admin_id,
    reviewed_at = now()
  where person_id = v_claim.person_id and id <> v_claim.id and status = 'pending';

  update public.people set claimed_by = v_claim.user_id, is_verified = true, updated_at = now()
  where id = v_claim.person_id;

  update public.users set
    linked_profile_id = v_claim.person_id,
    role = 'professional'::user_role,
    updated_at = now()
  where id = v_claim.user_id
  returning * into v_user;

  return jsonb_build_object(
    'claim_id', v_claim.id,
    'user_id', v_claim.user_id,
    'person_id', v_claim.person_id,
    'person_name', v_person.name,
    'email', v_user.email,
    'user_name', v_user.name
  );
end;
$$;

create or replace function public.review_actor_credit_request(
  p_request_id uuid,
  p_admin_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.actor_credit_requests%rowtype;
  v_film_id uuid;
  v_credit_id uuid;
  v_film jsonb;
  v_title text;
  v_role text;
  v_billing integer;
begin
  if not exists (
    select 1 from public.users where id = p_admin_id and role = 'admin'::user_role
  ) then
    raise exception 'Full admin access required';
  end if;
  if p_decision not in ('approve', 'reject') then raise exception 'Invalid decision'; end if;

  select * into v_request
  from public.actor_credit_requests
  where id = p_request_id
  for update;

  if v_request.id is null then raise exception 'Request not found'; end if;
  if v_request.status not in ('submitted', 'in_review', 'needs_information') then
    raise exception 'Request is no longer reviewable';
  end if;

  if p_decision = 'reject' then
    update public.actor_credit_requests set
      status = 'rejected', rejection_reason = nullif(trim(p_note), ''),
      reviewer_note = nullif(trim(p_note), ''), reviewed_by = p_admin_id,
      reviewed_at = now(), updated_at = now()
    where id = v_request.id;
    return jsonb_build_object('request_id', v_request.id, 'status', 'rejected');
  end if;

  if v_request.request_type = 'remove' then
    select film_id into v_film_id from public.credits
    where id = v_request.credit_id and person_id = v_request.person_id for update;
    if v_film_id is null then raise exception 'Credit no longer exists for this actor'; end if;
    delete from public.credits where id = v_request.credit_id and person_id = v_request.person_id;
  else
    v_role := lower(trim(v_request.role));
    if v_role = '' then raise exception 'Role is required'; end if;

    if v_request.request_type = 'add_existing' then
      v_film_id := v_request.film_id;
    else
      v_film := v_request.proposed_film;
      v_title := nullif(trim(v_film->>'title'), '');
      if v_title is null then raise exception 'Film title is required'; end if;

      if exists (
        select 1 from public.films
        where lower(trim(title)) = lower(v_title)
          and coalesce(year, 0) = coalesce(nullif(v_film->>'year', '')::integer, 0)
      ) then
        raise exception 'A film with this title and year already exists; attach the request to that film first';
      end if;

      insert into public.films (
        title, content_type, year, release_type, synopsis, genres,
        runtime_minutes, language, languages, countries, release_date,
        nfvcb_rating, youtube_watch_url, trailer_youtube_id, poster_url,
        status, source, needs_review, is_published
      ) values (
        v_title,
        coalesce(nullif(v_film->>'content_type', ''), 'movie'),
        nullif(v_film->>'year', '')::integer,
        nullif(v_film->>'release_type', ''),
        nullif(trim(v_film->>'synopsis'), ''),
        case when jsonb_typeof(v_film->'genres') = 'array' then array(select jsonb_array_elements_text(v_film->'genres')) else null end,
        nullif(v_film->>'runtime_minutes', '')::integer,
        nullif(trim(v_film->>'language'), ''),
        case when nullif(trim(v_film->>'language'), '') is not null then string_to_array(v_film->>'language', ',') else null end,
        case when jsonb_typeof(v_film->'countries') = 'array' then array(select jsonb_array_elements_text(v_film->'countries')) else null end,
        nullif(v_film->>'release_date', '')::date,
        nullif(v_film->>'nfvcb_rating', '')::nfvcb_rating,
        nullif(trim(v_film->>'youtube_watch_url'), ''),
        nullif(trim(v_film->>'trailer_youtube_id'), ''),
        nullif(trim(v_film->>'poster_url'), ''),
        case when v_film->>'release_type' = 'unreleased'
          or coalesce(nullif(v_film->>'year', '')::integer, extract(year from now())::integer) > extract(year from now())::integer
          then 'upcoming'::film_status else 'released'::film_status end,
        'actor_submission', true, true
      ) returning id into v_film_id;
    end if;

    if not exists (select 1 from public.films where id = v_film_id) then
      raise exception 'Film not found';
    end if;
    if exists (
      select 1 from public.credits
      where film_id = v_film_id and person_id = v_request.person_id and lower(trim(role)) = v_role
    ) then
      raise exception 'This actor already has the requested role on the film';
    end if;

    select coalesce(max(billing_order), 0) + 1 into v_billing
    from public.credits where film_id = v_film_id;

    insert into public.credits (
      film_id, person_id, role, character_name, billing_order, source
    ) values (
      v_film_id, v_request.person_id, v_role,
      nullif(trim(v_request.character_name), ''), v_billing, 'actor_claim'
    ) returning id into v_credit_id;
  end if;

  update public.actor_credit_requests set
    status = 'approved', reviewer_note = nullif(trim(p_note), ''),
    reviewed_by = p_admin_id, reviewed_at = now(),
    applied_film_id = v_film_id, applied_credit_id = v_credit_id,
    updated_at = now()
  where id = v_request.id;

  return jsonb_build_object(
    'request_id', v_request.id, 'status', 'approved',
    'film_id', v_film_id, 'credit_id', v_credit_id
  );
end;
$$;

revoke all on function public.approve_actor_profile_claim(uuid, uuid) from public, anon, authenticated;
revoke all on function public.review_actor_credit_request(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.prevent_duplicate_actor_claim() from public, anon, authenticated;
grant execute on function public.approve_actor_profile_claim(uuid, uuid) to service_role;
grant execute on function public.review_actor_credit_request(uuid, uuid, text, text) to service_role;
