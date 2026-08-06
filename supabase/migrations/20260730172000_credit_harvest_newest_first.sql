-- Make the credit harvester follow the Films admin page's default order:
-- page 1 first ("Recently Added" = films.created_at desc), then backwards.
--
-- This affects already-enqueued pending jobs because the claim function now
-- orders by the linked film row instead of the job row's older popularity
-- priority. Approval pagination uses the same film ordering so newly harvested
-- page-1 movies surface first for review.

create index if not exists films_created_at_desc_idx
  on public.films (created_at desc, id);

create index if not exists credit_harvest_jobs_pending_film_idx
  on public.credit_harvest_jobs (film_id)
  where status = 'pending';

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
    join public.films as film on film.id = job.film_id
    where job.status = 'pending'
    order by
      film.created_at desc nulls last,
      job.priority desc,
      job.created_at asc,
      job.id
    for update of job skip locked
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
