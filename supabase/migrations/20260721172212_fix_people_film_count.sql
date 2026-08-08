-- =============================================================================
-- FIX people.film_count — it was stale, and everything downstream trusted it
-- =============================================================================
-- people.film_count had drifted badly: a 40-person sample of records reading
-- film_count = 0 ALL had real credits. That matters because the admin
-- deduplicator shows it as "CREDITS n" (so reviewers pick the wrong survivor)
-- and purge_orphan_people/auto_merge_empty_people treat 0 as "empty stub" —
-- purging on it would have deleted thousands of real, credited people.
--
-- Done server-side in one statement because the client connection is currently
-- ~10s/query; 33k row-by-row updates would take hours.
--
-- 1. recompute from the source of truth (credits)
-- 2. trigger keeps it correct from now on, so it can't drift again
-- =============================================================================

-- 1a. people who have credits -> real distinct-film count
update public.people p
set film_count = c.cnt
from (
  select person_id, count(distinct film_id)::int as cnt
  from public.credits
  where person_id is not null
  group by person_id
) c
where p.id = c.person_id
  and p.film_count is distinct from c.cnt;

-- 1b. people with no credits at all -> 0 (not null)
update public.people p
set film_count = 0
where p.film_count is distinct from 0
  and not exists (select 1 from public.credits cr where cr.person_id = p.id);

-- 2. keep it in sync on any credits change (insert/update/delete)
create or replace function public.sync_person_film_count()
returns trigger
language plpgsql
as $$
declare
  pid uuid;
begin
  -- recount for every person touched (person_id can change on UPDATE)
  foreach pid in array (
    select array(
      select distinct x from unnest(array[
        case when tg_op <> 'INSERT' then old.person_id end,
        case when tg_op <> 'DELETE' then new.person_id end
      ]) x where x is not null
    )
  )
  loop
    update public.people
    set film_count = (select count(distinct film_id)::int from public.credits where person_id = pid)
    where id = pid;
  end loop;
  return null;
end;
$$;

drop trigger if exists trg_credits_sync_film_count on public.credits;
create trigger trg_credits_sync_film_count
  after insert or update or delete on public.credits
  for each row
  execute function public.sync_person_film_count();
