-- Match credit harvest ordering to the frontend Recently Added order.
--
-- Public frontend latest rails use films.created_at desc. The credit harvester
-- should therefore work newest-created published YouTube movies first, then move
-- backward, instead of following films.updated_at.

set statement_timeout = 0;

create index if not exists films_youtube_created_at_desc_idx
  on public.films (created_at desc, id)
  where youtube_watch_url is not null
    and is_published = true;

create index if not exists credit_harvest_jobs_pending_newest_claim_idx
  on public.credit_harvest_jobs (priority desc, created_at asc, id)
  where status = 'pending';

create or replace function public.set_credit_harvest_job_newest_priority()
returns trigger
language plpgsql
security definer
set search_path = public
as $priority$
declare
  film_created_at timestamptz;
begin
  if coalesce(new.status, '') <> 'pending' then
    return new;
  end if;

  select f.created_at
    into film_created_at
  from public.films as f
  where f.id = new.film_id
    and f.youtube_watch_url is not null
    and f.is_published = true;

  if film_created_at is not null then
    new.priority := least(floor(extract(epoch from film_created_at)), 2000000000)::integer;
  end if;

  return new;
end;
$priority$;

drop trigger if exists set_credit_harvest_job_newest_priority
  on public.credit_harvest_jobs;

create trigger set_credit_harvest_job_newest_priority
before insert or update of film_id, status
on public.credit_harvest_jobs
for each row
execute function public.set_credit_harvest_job_newest_priority();

drop trigger if exists sync_credit_harvest_job_updated_priority
  on public.films;

drop function if exists public.sync_credit_harvest_job_updated_priority();

create or replace function public.sync_credit_harvest_job_created_priority()
returns trigger
language plpgsql
security definer
set search_path = public
as $sync$
declare
  film_priority integer;
begin
  if new.youtube_watch_url is null
    or new.is_published is distinct from true
    or new.created_at is null
  then
    return new;
  end if;

  film_priority := least(floor(extract(epoch from new.created_at)), 2000000000)::integer;

  update public.credit_harvest_jobs as job
  set priority = film_priority
  where job.film_id = new.id
    and job.status = 'pending'
    and job.priority is distinct from film_priority;

  return new;
end;
$sync$;

drop trigger if exists sync_credit_harvest_job_created_priority
  on public.films;

create trigger sync_credit_harvest_job_created_priority
after insert or update of created_at, youtube_watch_url, is_published
on public.films
for each row
execute function public.sync_credit_harvest_job_created_priority();

with pending_priorities as (
  select
    job.id,
    least(floor(extract(epoch from f.created_at)), 2000000000)::integer as refreshed_priority
  from public.credit_harvest_jobs as job
  join public.films as f on f.id = job.film_id
  where job.status = 'pending'
    and f.youtube_watch_url is not null
    and f.is_published = true
    and f.created_at is not null
)
update public.credit_harvest_jobs as job
set priority = pending_priorities.refreshed_priority
from pending_priorities
where job.id = pending_priorities.id
  and job.priority is distinct from pending_priorities.refreshed_priority;

create or replace function public.claim_credit_harvest_job(p_worker_id text default null)
returns table (
  id uuid,
  film_id uuid,
  channel_id uuid,
  attempts smallint
)
language plpgsql
security definer
set search_path = public
as $claim$
begin
  if coalesce(
    (select control.paused from public.credit_harvest_control as control where control.id = 1),
    false
  ) then
    return;
  end if;

  return query
  with next_job as (
    select job.id
    from public.credit_harvest_jobs as job
    where job.status = 'pending'
      and exists (
        select 1
        from public.films as film
        where film.id = job.film_id
          and film.youtube_watch_url is not null
          and film.is_published = true
      )
    order by
      job.priority desc,
      job.created_at asc,
      job.id
    for update skip locked
    limit 1
  )
  update public.credit_harvest_jobs as job
  set
    status = 'running',
    attempts = job.attempts + 1,
    started_at = now(),
    worker_id = nullif(trim(p_worker_id), ''),
    heartbeat_at = now()
  from next_job
  where job.id = next_job.id
  returning job.id, job.film_id, job.channel_id, job.attempts;
end;
$claim$;

revoke all on function public.claim_credit_harvest_job(text) from public;
grant execute on function public.claim_credit_harvest_job(text) to service_role;

create or replace function public.get_credit_candidate_review_films(
  p_status text default 'pending',
  p_min_confidence real default 0,
  p_limit integer default 1,
  p_offset integer default 0
)
returns table (
  film_id uuid,
  candidate_count bigint,
  max_confidence real,
  total_films bigint
)
language sql
stable
security invoker
set search_path = public
as $review$
  with grouped as (
    select
      c.film_id,
      count(*) as candidate_count,
      max(c.confidence)::real as max_confidence,
      min(c.created_at) as first_created,
      max(f.created_at) as film_created
    from public.credit_candidates as c
    join public.films as f on f.id = c.film_id
    where c.status = p_status
      and c.confidence >= p_min_confidence
      and f.youtube_watch_url is not null
      and f.is_published = true
    group by c.film_id
  ),
  counted as (
    select
      grouped.*,
      count(*) over () as total_films
    from grouped
  )
  select
    counted.film_id,
    counted.candidate_count,
    counted.max_confidence,
    counted.total_films
  from counted
  order by
    counted.film_created desc nulls last,
    counted.first_created asc,
    counted.max_confidence desc,
    counted.film_id
  limit greatest(1, least(coalesce(p_limit, 1), 50))
  offset greatest(coalesce(p_offset, 0), 0);
$review$;

revoke all on function public.get_credit_candidate_review_films(text, real, integer, integer) from public;
grant execute on function public.get_credit_candidate_review_films(text, real, integer, integer) to authenticated;
grant execute on function public.get_credit_candidate_review_films(text, real, integer, integer) to service_role;

revoke all on function public.set_credit_harvest_job_newest_priority() from public;
revoke all on function public.sync_credit_harvest_job_created_priority() from public;

comment on function public.claim_credit_harvest_job(text) is
  'Claims the pending credit harvest job for the newest-created published YouTube film first, matching the frontend Recently Added order.';

comment on function public.get_credit_candidate_review_films(text, real, integer, integer) is
  'Groups pending credit candidates by film, ordered by newest-created published YouTube films first.';