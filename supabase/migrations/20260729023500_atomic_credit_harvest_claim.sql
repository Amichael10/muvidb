-- Atomically claim one credit-harvest job.
--
-- Multiple workers must not use a separate SELECT followed by UPDATE: two
-- workers can select the same pending row before either update commits. Row
-- locking with SKIP LOCKED lets each worker receive a different film.
create or replace function public.claim_credit_harvest_job()
returns table (
  id uuid,
  film_id uuid,
  channel_id uuid,
  attempts smallint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with next_job as (
    select j.id
    from public.credit_harvest_jobs as j
    where j.status = 'pending'
    order by j.priority desc, j.created_at asc
    for update skip locked
    limit 1
  )
  update public.credit_harvest_jobs as j
  set
    status = 'running',
    attempts = j.attempts + 1,
    started_at = now()
  from next_job
  where j.id = next_job.id
  returning j.id, j.film_id, j.channel_id, j.attempts;
end;
$$;

revoke all on function public.claim_credit_harvest_job() from public;
grant execute on function public.claim_credit_harvest_job() to service_role;
