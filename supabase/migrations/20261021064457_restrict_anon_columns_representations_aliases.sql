-- Narrow what an anonymous (logged-out) visitor can read from two tables.
--
-- Both tables are legitimately public-read: company pages and person pages show
-- representation/booking details, and search resolves alternate spellings through
-- person_aliases. But anon was granted SELECT on *every* column, including fields
-- the UI never displays:
--
--   talent_representations.notes  -- private free-text (14 rows populated); fetched
--                                    into the browser by PersonDetailV2 but never
--                                    rendered by any component.
--   person_aliases.source/confidence -- our name-matching intelligence: which alias
--                                    came from where and how sure the matcher was.
--
-- Column-level grants are used rather than policy changes: the row-level policies
-- are correct (these rows *are* public), it is the column set that was too wide.
--
-- `authenticated` is deliberately left with full table SELECT. companyClient's
-- saveTalentRepresentation() does `.select('*')` after insert/update, so narrowing
-- authenticated would break the company roster editor. Signup is free, so this is
-- not a security boundary on its own -- it removes the anonymous bulk path and
-- makes reading these fields require an account.

-- talent_representations: everything except notes
revoke select on public.talent_representations from anon;
grant select (
  id,
  person_id,
  company_id,
  representation_type,
  agent_name,
  contact_email,
  contact_phone,
  booking_url,
  is_primary,
  created_at,
  updated_at
) on public.talent_representations to anon;

-- person_aliases: only what search and the person page actually use.
-- alias_key is kept because peopleSearch filters on it (`.eq('alias_key', ...)`),
-- and a filtered column still requires SELECT privilege.
revoke select on public.person_aliases from anon;
grant select (
  id,
  person_id,
  alias,
  alias_key
) on public.person_aliases to anon;
