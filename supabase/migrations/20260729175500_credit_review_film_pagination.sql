-- Reconstructed from remote supabase_migrations.schema_migrations.
-- This migration was applied directly to the remote database and was never
-- committed. The file is restored here so local and remote history match.

-- One-film-at-a-time pagination for the credit review dashboard.
-- Returning the distinct film page from SQL prevents candidate-level LIMITs
-- from splitting one film's ensemble across several incomplete UI groups.
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
as $$
  with grouped as (
    select
      c.film_id,
      count(*) as candidate_count,
      max(c.confidence)::real as max_confidence,
      min(c.created_at) as first_created
    from public.credit_candidates as c
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
  -- FIFO keeps the page order stable while workers append new films.
  order by counted.first_created asc, counted.max_confidence desc, counted.film_id
  limit greatest(1, least(coalesce(p_limit, 1), 50))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.get_credit_candidate_review_films(text, real, integer, integer) from public;

grant execute on function public.get_credit_candidate_review_films(text, real, integer, integer) to authenticated;

grant execute on function public.get_credit_candidate_review_films(text, real, integer, integer) to service_role;
