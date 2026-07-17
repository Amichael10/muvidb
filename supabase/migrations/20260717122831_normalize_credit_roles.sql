-- =============================================================================
-- CREDITS.ROLE — one canonical casing
-- =============================================================================
-- credits.role had drifted into mixed case: "Actor" (676) vs "actor", "Producer"
-- vs "producer", plus "Cast". That isn't only untidy — several jobs match the
-- column case-sensitively, e.g.
--
--   sync_service.ts:  .eq('role', 'producer')     -- missed every "Producer" row
--   batch_enrich_credits.ts, apply_amvca_awards.ts: same pattern
--
-- so those queries have silently been matching a subset of the data.
--
-- Canonical form is LOWERCASE. The UI renders Sentence case at display time (see
-- formatRole in src/lib/creditRoles.js), which keeps every existing lower-cased
-- comparison working. Six writers touch this column (admin drawers, TMDB
-- enrichment, harvest scripts), so a trigger enforces the rule rather than each
-- writer being asked to remember it.
--
-- Safe to re-run.
-- =============================================================================

-- 1. Dedupe first: credits has a unique index on (film_id, person_id, role), but
--    casing slipped past it — the same person sits on the same film twice, once
--    as "Director" and once as "director" (1,403 such pairs). They already render
--    as duplicate crew entries. Lowercasing would collide on the index, so the
--    redundant row must go first.
--
--    Rows are copied to credits_case_dupe_backup before deletion. To restore:
--      insert into public.credits
--      select id, film_id, person_id, role, character_name, billing_order, created_at
--      from public.credits_case_dupe_backup;
create table if not exists public.credits_case_dupe_backup (like public.credits including defaults);

with ranked as (
  select id,
         row_number() over (
           partition by film_id, person_id, lower(btrim(role))
           -- Keep the richest row: one with a character name beats one without,
           -- then top billing, then oldest id as a stable tie-break.
           order by (nullif(btrim(coalesce(character_name, '')), '') is not null) desc,
                    billing_order asc nulls last,
                    id asc
         ) as rn
  from public.credits
  where role is not null
)
insert into public.credits_case_dupe_backup
select c.* from public.credits c
join ranked r on r.id = c.id
where r.rn > 1
  and not exists (select 1 from public.credits_case_dupe_backup b where b.id = c.id);

delete from public.credits c
using public.credits_case_dupe_backup b
where c.id = b.id;

-- 2. Backfill the survivors.
update public.credits
set role = lower(btrim(role))
where role is not null
  and role <> lower(btrim(role));

-- 3. Keep it that way, whatever the writer sends.
create or replace function public.normalize_credit_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is not null then
    new.role := lower(btrim(new.role));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_normalize_credit_role on public.credits;
create trigger trg_normalize_credit_role
  before insert or update of role on public.credits
  for each row
  execute function public.normalize_credit_role();
