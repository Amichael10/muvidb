-- Fast newest-first claiming for credit harvest workers.
--
-- The previous newest-first claim joined every pending job to films and sorted
-- by films.created_at on each worker claim. With a large queue this can hit the
-- database statement timeout. Keep the ordering, but denormalize each film's
-- created_at timestamp into credit_harvest_jobs.priority and claim from the
-- indexed jobs table.

update public.credit_harvest_jobs as job
set priority = least(floor(extract(epoch from film.created_at))::integer, 2000000000)
from public.films as film
where film.id = job.film_id
  and job.status = 'pending'
  and film.created_at is not null
  and job.priority is distinct from least(floor(extract(epoch from film.created_at))::integer, 2000000000);

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
  film_created timestamptz;
begin
  select films.created_at
    into film_created
  from public.films
  where films.id = new.film_id;

  if film_created is not null then
    new.priority := least(floor(extract(epoch from film_created))::integer, 2000000000);
  end if;

  return new;
end;
$priority$;

drop trigger if exists set_credit_harvest_job_newest_priority
  on public.credit_harvest_jobs;

create trigger set_credit_harvest_job_newest_priority
before insert or update of film_id
on public.credit_harvest_jobs
for each row
execute function public.set_credit_harvest_job_newest_priority();

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
