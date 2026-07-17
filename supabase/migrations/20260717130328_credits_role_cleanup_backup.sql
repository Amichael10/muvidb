-- =============================================================================
-- CREDITS ROLE CLEANUP — quarantine table
-- =============================================================================
-- Holds rows removed by the credits.role cleanup so the repair is reversible:
--   reason='garbage'  — an AI extraction pipeline wrote its own commentary into
--                       the role column ("no specific role listed, possibly an
--                       error in the ocr output...", "(duplicate, omitted)").
--   reason='collide'  — remapping d.o.p/d.o.p 1/d.o.p 2 onto 'cinematographer'
--                       made the row a restatement of one already held by the
--                       same person on the same film, which
--                       credits_film_person_role_uidx rejects.
--
-- To restore a row:
--   insert into public.credits (id, film_id, person_id, role, character_name, billing_order)
--   select id, film_id, person_id, role, character_name, billing_order
--   from public.credits_role_cleanup_backup where reason = 'garbage';
--
-- RLS on with no policies: this holds deleted content and must never be
-- readable through the public API. service_role bypasses RLS, which is what the
-- repair script and any future restore use.
-- =============================================================================

create table if not exists public.credits_role_cleanup_backup (
  id            uuid primary key,
  film_id       uuid,
  person_id     uuid,
  role          text,
  character_name text,
  billing_order integer,
  reason        text not null,
  backed_up_at  timestamptz not null default now()
);

alter table public.credits_role_cleanup_backup enable row level security;

grant select, insert on public.credits_role_cleanup_backup to service_role;
