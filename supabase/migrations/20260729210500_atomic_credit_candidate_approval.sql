-- Reconstructed from remote supabase_migrations.schema_migrations.
-- This migration was applied directly to the remote database and was never
-- committed. The file is restored here so local and remote history match.

-- Approve one harvested credit atomically.
--
-- The previous browser flow performed person creation, credit insertion, and
-- candidate approval as separate requests. A failure between those requests
-- could leave an orphan person/credit or a candidate incorrectly stuck in
-- Pending. Keeping all three writes in one function makes each approval
-- all-or-nothing and lets the review queue advance reliably.
create or replace function public.approve_credit_candidate(
  p_candidate_id uuid,
  p_name text,
  p_credit_type text,
  p_role_or_character text default null,
  p_matched_person_id uuid default null
)
returns table (
  person_id uuid,
  created_person boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate public.credit_candidates%rowtype;
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '[[:space:]]+', ' ', 'g'));
  v_detail text := nullif(btrim(regexp_replace(coalesce(p_role_or_character, ''), '[[:space:]]+', ' ', 'g')), '');
  v_person_id uuid;
  v_created boolean := false;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select *
  into v_candidate
  from public.credit_candidates
  where id = p_candidate_id
  for update;

  if not found then
    raise exception 'Credit candidate not found';
  end if;

  if v_candidate.status <> 'pending' then
    raise exception 'Credit candidate is already %', v_candidate.status;
  end if;

  if v_name = '' or array_length(regexp_split_to_array(v_name, '[[:space:]]+'), 1) < 2 then
    raise exception 'A person name must contain at least two words';
  end if;

  if p_credit_type not in ('actor', 'crew') then
    raise exception 'Type must be actor or crew';
  end if;

  if p_credit_type = 'crew' and v_detail is null then
    raise exception 'Crew candidates need a role';
  end if;

  if p_matched_person_id is not null then
    select p.id
    into v_person_id
    from public.people as p
    where p.id = p_matched_person_id;

    if v_person_id is null then
      raise exception 'Selected person profile no longer exists';
    end if;
  else
    v_person_id := public.find_person_by_name(v_name);
    if v_person_id is null then
      v_created := true;
      v_person_id := public.upsert_person_by_name(v_name, '{}'::jsonb);
    end if;
  end if;

  if v_person_id is null then
    raise exception 'Could not resolve or create person profile';
  end if;

  insert into public.credits (
    film_id,
    person_id,
    role,
    character_name
  )
  values (
    v_candidate.film_id,
    v_person_id,
    case when p_credit_type = 'crew' then v_detail else 'actor' end,
    case when p_credit_type = 'actor' then v_detail else null end
  )
  on conflict do nothing;

  update public.credit_candidates
  set
    raw_name = v_name,
    credit_type = p_credit_type,
    role_or_character = v_detail,
    matched_person_id = v_person_id,
    status = 'approved',
    reviewed_at = now()
  where id = p_candidate_id;

  return query
  select v_person_id, v_created;
end;
$$;

revoke all on function public.approve_credit_candidate(uuid, text, text, text, uuid) from public;

grant execute on function public.approve_credit_candidate(uuid, text, text, text, uuid) to authenticated;

grant execute on function public.approve_credit_candidate(uuid, text, text, text, uuid) to service_role;

comment on function public.approve_credit_candidate(uuid, text, text, text, uuid) is
  'Atomically resolves/creates a person, inserts their credit, and marks one harvested candidate approved.';
