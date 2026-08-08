-- Credit harvester metadata suggestions.
--
-- The worker still never mutates live film records directly. It writes text-only
-- movie metadata suggestions here, and admins approve them from the credit
-- harvester review page.

create table if not exists public.credit_metadata_candidates (
  id uuid primary key default gen_random_uuid(),
  film_id uuid not null references public.films(id) on delete cascade,
  job_id uuid references public.credit_harvest_jobs(id) on delete set null,
  source text not null default 'youtube_metadata',
  source_url text,
  source_title text,
  source_description text,
  source_evidence jsonb not null default '{}'::jsonb,
  synopsis text,
  language text,
  release_year integer check (
    release_year is null
    or (release_year between 1888 and 2100)
  ),
  age_rating text check (
    age_rating is null
    or age_rating in ('G', 'PG', 'PG-13', '15', '18')
  ),
  production_company text,
  confidence real not null default 0 check (confidence >= 0 and confidence <= 1),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists credit_metadata_candidates_review_idx
  on public.credit_metadata_candidates (status, created_at desc);

create index if not exists credit_metadata_candidates_film_idx
  on public.credit_metadata_candidates (film_id, status);

create unique index if not exists credit_metadata_candidates_pending_source_idx
  on public.credit_metadata_candidates (film_id, source)
  where status = 'pending';

create index if not exists companies_lower_name_idx
  on public.companies (lower(name));

alter table public.credit_metadata_candidates enable row level security;

drop policy if exists "credit_metadata_candidates admin" on public.credit_metadata_candidates;
create policy "credit_metadata_candidates admin" on public.credit_metadata_candidates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.credit_metadata_candidates to authenticated;
grant all on public.credit_metadata_candidates to service_role;

create or replace function public.approve_credit_metadata_candidate(
  p_candidate_id uuid,
  p_synopsis text default null,
  p_language text default null,
  p_release_year integer default null,
  p_age_rating text default null,
  p_production_company text default null
)
returns table (
  film_id uuid,
  company_id uuid,
  created_company boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate public.credit_metadata_candidates%rowtype;
  v_synopsis text;
  v_language text;
  v_release_year integer;
  v_age_rating text;
  v_company_name text;
  v_company_id uuid;
  v_created_company boolean := false;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select *
  into v_candidate
  from public.credit_metadata_candidates
  where id = p_candidate_id
  for update;

  if not found then
    raise exception 'Metadata candidate not found';
  end if;

  if v_candidate.status <> 'pending' then
    raise exception 'Metadata candidate is already %', v_candidate.status;
  end if;

  v_synopsis := nullif(btrim(regexp_replace(coalesce(p_synopsis, v_candidate.synopsis, ''), '[[:space:]]+', ' ', 'g')), '');
  v_language := nullif(btrim(regexp_replace(coalesce(p_language, v_candidate.language, ''), '[[:space:]]+', ' ', 'g')), '');
  v_release_year := coalesce(p_release_year, v_candidate.release_year);
  v_age_rating := nullif(upper(btrim(coalesce(p_age_rating, v_candidate.age_rating, ''))), '');
  v_company_name := nullif(btrim(regexp_replace(coalesce(p_production_company, v_candidate.production_company, ''), '[[:space:]]+', ' ', 'g')), '');

  if v_release_year is not null and (
    v_release_year < 1888
    or v_release_year > extract(year from now())::integer + 2
  ) then
    raise exception 'Release year % is outside the allowed range', v_release_year;
  end if;

  if v_age_rating is not null and v_age_rating not in ('G', 'PG', 'PG-13', '15', '18') then
    raise exception 'Content rating % is not supported', v_age_rating;
  end if;

  update public.films
  set
    synopsis = coalesce(v_synopsis, synopsis),
    language = coalesce(v_language, language),
    languages = case
      when v_language is null then languages
      else regexp_split_to_array(v_language, '\s*[,/&|;]\s*')
    end,
    year = coalesce(v_release_year, year),
    nfvcb_rating = coalesce(v_age_rating::public.nfvcb_rating, nfvcb_rating),
    updated_at = now()
  where id = v_candidate.film_id;

  if v_company_name is not null then
    select c.id
    into v_company_id
    from public.companies as c
    where lower(btrim(c.name)) = lower(v_company_name)
    order by c.created_at asc
    limit 1;

    if v_company_id is null then
      insert into public.companies (
        name,
        description,
        website,
        company_type
      )
      values (
        v_company_name,
        '.',
        '.',
        'production'
      )
      returning id into v_company_id;
      v_created_company := true;
    end if;

    delete from public.film_companies
    where film_id = v_candidate.film_id
      and role = 'production'::public.company_film_role;

    insert into public.film_companies (film_id, company_id, role)
    values (
      v_candidate.film_id,
      v_company_id,
      'production'::public.company_film_role
    );
  end if;

  update public.credit_metadata_candidates
  set
    synopsis = v_synopsis,
    language = v_language,
    release_year = v_release_year,
    age_rating = v_age_rating,
    production_company = v_company_name,
    status = 'approved',
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    updated_at = now()
  where id = p_candidate_id;

  return query
  select v_candidate.film_id, v_company_id, v_created_company;
end;
$$;

revoke all on function public.approve_credit_metadata_candidate(uuid, text, text, integer, text, text) from public;
grant execute on function public.approve_credit_metadata_candidate(uuid, text, text, integer, text, text) to authenticated;
grant execute on function public.approve_credit_metadata_candidate(uuid, text, text, integer, text, text) to service_role;

create or replace function public.reject_credit_metadata_candidate(
  p_candidate_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  update public.credit_metadata_candidates
  set
    status = 'rejected',
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    updated_at = now()
  where id = p_candidate_id
    and status = 'pending';

  if not found then
    raise exception 'Pending metadata candidate not found';
  end if;
end;
$$;

revoke all on function public.reject_credit_metadata_candidate(uuid) from public;
grant execute on function public.reject_credit_metadata_candidate(uuid) to authenticated;
grant execute on function public.reject_credit_metadata_candidate(uuid) to service_role;

comment on table public.credit_metadata_candidates is
  'Text-only movie metadata suggestions from the credit harvester. Admin approval updates films/companies.';

comment on function public.approve_credit_metadata_candidate(uuid, text, text, integer, text, text) is
  'Atomically approves one harvested metadata suggestion into films and the production company link.';