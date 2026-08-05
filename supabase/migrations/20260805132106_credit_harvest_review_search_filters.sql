-- Add searchable filters to the credit harvest review-film pager.

set statement_timeout = 0;

drop function if exists public.get_credit_candidate_review_films(text, real, integer, integer);
drop function if exists public.get_credit_candidate_review_films(text, real, integer, integer, text, integer, text);

create or replace function public.get_credit_candidate_review_films(
  p_status text default 'pending',
  p_min_confidence real default 0,
  p_limit integer default 1,
  p_offset integer default 0,
  p_search text default null,
  p_year integer default null,
  p_credit_type text default null
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
  with filters as (
    select
      nullif(btrim(coalesce(p_search, '')), '') as search_text,
      nullif(btrim(coalesce(p_credit_type, '')), '') as credit_type
  ),
  grouped as (
    select
      c.film_id,
      count(*) as candidate_count,
      max(c.confidence)::real as max_confidence,
      min(c.created_at) as first_created,
      max(f.created_at) as film_created
    from public.credit_candidates as c
    join public.films as f on f.id = c.film_id
    cross join filters
    where c.status = p_status
      and c.confidence >= p_min_confidence
      and f.youtube_watch_url is not null
      and f.is_published = true
      and (
        filters.search_text is null
        or f.title ilike '%' || filters.search_text || '%'
        or f.slug ilike '%' || filters.search_text || '%'
      )
      and (p_year is null or f.year = p_year)
      and (filters.credit_type is null or c.credit_type = filters.credit_type)
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

revoke all on function public.get_credit_candidate_review_films(text, real, integer, integer, text, integer, text) from public;
grant execute on function public.get_credit_candidate_review_films(text, real, integer, integer, text, integer, text) to authenticated;
grant execute on function public.get_credit_candidate_review_films(text, real, integer, integer, text, integer, text) to service_role;

comment on function public.get_credit_candidate_review_films(text, real, integer, integer, text, integer, text) is
  'Groups credit candidates by film for admin review, with optional film search, year, and actor/crew filters.';

notify pgrst, 'reload schema';